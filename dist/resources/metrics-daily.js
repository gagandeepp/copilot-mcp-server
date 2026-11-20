import { ResourceTemplate } from "@modelcontextprotocol/server";
import { fetchMetrics, metricsErrorMessage } from "../data/metrics.js";
import { getToken } from "../github-client.js";
import { completeOrg } from "../org-completion.js";
import { JSON_MIME, METRICS_DAILY_TEMPLATE } from "../resource-uris.js";
import { dayFromUri, jsonContents, orgFromUri, resourceError } from "./read.js";
export function registerMetricsDailyResource(server) {
    server.registerResource("copilot_metrics_daily", 
    // One URI per org and day is unbounded, so nothing is listed; clients build the URI themselves.
    new ResourceTemplate(METRICS_DAILY_TEMPLATE, { list: undefined, complete: { org: completeOrg } }), {
        title: "Copilot usage metrics, one day",
        description: "The usage-metrics report of one organization for one UTC day (YYYY-MM-DD, from 2025-10-10, up to a year back): the same data as get_copilot_metrics in JSON mode with `day`. `available: false` means GitHub has no report for that day.",
        mimeType: JSON_MIME,
        // A report that exists is final, so a day is a safe lifetime (an `available: false` answer for a very recent day can lag behind by up to that long).
        cacheHint: { ttlMs: 86_400_000, cacheScope: "private" },
    }, async (uri, variables, ctx) => {
        const org = orgFromUri(variables.org);
        const day = dayFromUri(variables.day);
        try {
            return jsonContents(uri, await fetchMetrics(org, day, getToken(), ctx.mcpReq.signal));
        }
        catch (err) {
            throw resourceError(err, uri, metricsErrorMessage(err));
        }
    });
}
//# sourceMappingURL=metrics-daily.js.map