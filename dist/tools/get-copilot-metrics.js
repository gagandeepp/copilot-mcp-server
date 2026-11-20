import * as z from "zod/v4";
import { EmptyReportError, fetchMetrics, metricsErrorMessage, renderMetricsMarkdown } from "../data/metrics.js";
import { getToken } from "../github-client.js";
import { metrics28DayRef, metricsDailyRef } from "../resource-uris.js";
import { orgLogin, responseFormat } from "../schemas.js";
import { errorResult, formatResult, withResourceLink } from "./result.js";
export function registerGetCopilotMetrics(server) {
    server.registerTool("get_copilot_metrics", {
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
            response_format: responseFormat,
        }),
    }, async ({ org, day, response_format }, ctx) => {
        try {
            const data = await fetchMetrics(org, day, getToken(), ctx.mcpReq.signal);
            return withResourceLink(formatResult(data, response_format, renderMetricsMarkdown), day ? metricsDailyRef(org, day) : metrics28DayRef(org));
        }
        catch (err) {
            // An empty report is an error whose message needs no "Error: " prefix (unchanged behaviour).
            if (err instanceof EmptyReportError) {
                return { content: [{ type: "text", text: err.message }], isError: true };
            }
            return errorResult(metricsErrorMessage(err));
        }
    });
}
//# sourceMappingURL=get-copilot-metrics.js.map