import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { ApiError, downloadReport, getToken, githubFetch } from "../github-client.js";
import { parseReportFile, reportLinks, summarizeReports } from "../metrics-report.js";
import type { ReportRecord } from "../metrics-report.js";
import { orgLogin } from "../schemas.js";

const text = (value: string) => ({ content: [{ type: "text" as const, text: value }] });

// The client's generic 403/404 text is about billing; the reports API has its own access rules.
function metricsErrorMessage(err: unknown): string {
    if (!(err instanceof ApiError) || err.rateLimited) return (err as Error).message;
    const githubSays = err.message.match(/ GitHub says: .*$/s)?.[0] ?? "";
    if (err.status === 403) {
        return "Access denied (HTTP 403). Copilot usage metrics require an organization owner or the fine-grained " +
            "\"View Organization Copilot Metrics\" permission (classic tokens need read:org)." + githubSays;
    }
    if (err.status === 404) {
        return "Not found (HTTP 404). Check the org login with list_organizations, and that the organization's " +
            "\"Copilot usage metrics\" policy is enabled." + githubSays;
    }
    return err.message;
}

export function registerGetCopilotMetrics(server: McpServer): void {
    server.registerTool(
        "get_copilot_metrics",
        {
            title: "Copilot Usage Metrics",
            description: "Get Copilot usage metrics for an organization from GitHub's usage-metrics reports: daily, weekly and monthly active users, prompts, code generations, acceptances and lines of code, broken down by IDE, feature, language and model, with a per-day table for the 28-day report. Returns the latest 28-day report by default, or a single day's report when `day` is given. Requires an organization owner token or the fine-grained \"View Organization Copilot Metrics\" permission (classic tokens need read:org), and the organization's \"Copilot usage metrics\" policy must be enabled.",
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: true,
            },
            inputSchema: z.strictObject({
                org: orgLogin.describe("GitHub organization login (slug)"),
                day: z
                    .string()
                    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
                    .optional()
                    .describe("Return this single day's report (YYYY-MM-DD, UTC) instead of the latest 28 days. Daily reports start on 2025-10-10 and go back up to one year."),
            }),
        },
        async ({ org, day }, ctx) => {
            try {
                const token = getToken();

                const base = `/orgs/${encodeURIComponent(org)}/copilot/metrics/reports`;
                const path = day
                    ? `${base}/organization-1-day?${new URLSearchParams({ day })}`
                    : `${base}/organization-28-day/latest`;
                const response = await githubFetch<unknown>(path, token, ctx.mcpReq.signal);

                // 204 No Content: GitHub has no report to give.
                if (response === null) {
                    return text(
                        day
                            ? `No Copilot usage metrics report exists for ${day} in org "${org}". ` +
                              "Daily reports are available from 2025-10-10 and up to one year back, and a day's data can take up to two full UTC days after it ends to appear. " +
                              "Omit `day` to get the latest 28-day report."
                            : `GitHub has no 28-day Copilot usage metrics report for org "${org}" yet. Try again later.`
                    );
                }

                const links = reportLinks.safeParse(response);
                if (!links.success) {
                    throw new Error("GitHub returned an unexpected response (no download_links). Try again later.");
                }
                if (links.data.download_links.length === 0) {
                    return text(`GitHub returned a Copilot usage metrics report for org "${org}" with no download links. Try again later.`);
                }

                const records: ReportRecord[] = [];
                let malformed = 0;
                for (const link of links.data.download_links) {
                    const parsed = parseReportFile(await downloadReport(link, ctx.mcpReq.signal));
                    records.push(...parsed.records);
                    malformed += parsed.malformed;
                }

                if (records.length === 0) {
                    return {
                        ...text(`The Copilot usage metrics report for org "${org}" had no usable records (${malformed} malformed line(s) skipped).`),
                        isError: true,
                    };
                }
                return text(summarizeReports(org, records, malformed));
            } catch (err: unknown) {
                return {
                    content: [{ type: "text" as const, text: `Error: ${metricsErrorMessage(err)}` }],
                    isError: true,
                };
            }
        }
    );
}
