import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getToken, githubFetch } from "../github-client.js";
import type { CopilotMetricDay } from "../types.js";

export function registerGetCopilotMetrics(server: McpServer): void {
    server.registerTool(
        "get_copilot_metrics",
        {
            description: "Get aggregated Copilot usage metrics for an organization over recent days, including code completions, chat usage, and active/engaged user counts broken down by editor and model.",
            inputSchema: {
                org: z.string().describe("GitHub organization login (slug)"),
                since: z
                    .string()
                    .optional()
                    .describe("Start date in YYYY-MM-DD format (defaults to 28 days ago)"),
                until: z
                    .string()
                    .optional()
                    .describe("End date in YYYY-MM-DD format (defaults to yesterday)"),
            },
        },
        async ({ org, since, until }) => {
            try {
                const token = getToken();

                let path = `/orgs/${encodeURIComponent(org)}/copilot/metrics?per_page=28`;
                if (since) path += `&since=${since}`;
                if (until) path += `&until=${until}`;

                const metrics = await githubFetch<CopilotMetricDay[]>(path, token);

                if (!metrics || metrics.length === 0) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `No Copilot metrics found for org "${org}" in the specified date range.`,
                            },
                        ],
                    };
                }

                const lines: string[] = [
                    `## Copilot Usage Metrics for **${org}**`,
                    `_Showing ${metrics.length} day(s) of data_\n`,
                    `| Date | Active Users | Engaged Users | Completions Users | Chat (IDE) Users | Chat (Web) Users | PR Users |`,
                    `|------|-------------|---------------|-------------------|------------------|------------------|----------|`,
                ];

                for (const day of metrics) {
                    lines.push(
                        `| ${day.date} ` +
                        `| ${day.total_active_users} ` +
                        `| ${day.total_engaged_users} ` +
                        `| ${day.copilot_ide_code_completions?.total_engaged_users ?? "—"} ` +
                        `| ${day.copilot_ide_chat?.total_engaged_users ?? "—"} ` +
                        `| ${day.copilot_dotcom_chat?.total_engaged_users ?? "—"} ` +
                        `| ${day.copilot_dotcom_pull_requests?.total_engaged_users ?? "—"} |`
                    );
                }

                // Summary statistics
                const totalActive = metrics.reduce(
                    (sum, d) => Math.max(sum, d.total_active_users),
                    0
                );
                const totalEngaged = metrics.reduce(
                    (sum, d) => Math.max(sum, d.total_engaged_users),
                    0
                );
                const avgActive = (
                    metrics.reduce((sum, d) => sum + d.total_active_users, 0) /
                    metrics.length
                ).toFixed(1);
                const avgEngaged = (
                    metrics.reduce((sum, d) => sum + d.total_engaged_users, 0) /
                    metrics.length
                ).toFixed(1);

                lines.push(
                    `\n### Summary`,
                    `- Peak active users: ${totalActive}`,
                    `- Peak engaged users: ${totalEngaged}`,
                    `- Average daily active users: ${avgActive}`,
                    `- Average daily engaged users: ${avgEngaged}`
                );

                // Editor breakdown from latest day
                const latest = metrics[metrics.length - 1];
                if (latest.copilot_ide_code_completions?.editors) {
                    lines.push(`\n### Editor Breakdown (latest day: ${latest.date})`);
                    lines.push(`| Editor | Engaged Users |`);
                    lines.push(`|--------|---------------|`);
                    for (const editor of latest.copilot_ide_code_completions.editors) {
                        lines.push(`| ${editor.name} | ${editor.total_engaged_users} |`);
                    }
                }

                return {
                    content: [{ type: "text" as const, text: lines.join("\n") }],
                };
            } catch (err: unknown) {
                return {
                    content: [
                        { type: "text" as const, text: `Error: ${(err as Error).message}` },
                    ],
                    isError: true,
                };
            }
        }
    );
}
