import { ResourceTemplate } from "@modelcontextprotocol/server";
import type { McpServer } from "@modelcontextprotocol/server";
import { fetchMetrics, metricsErrorMessage } from "../data/metrics.js";
import { getToken } from "../github-client.js";
import { completeOrg, listOrgLogins } from "../org-completion.js";
import { JSON_MIME, METRICS_28_DAY_TEMPLATE, metrics28DayRef } from "../resource-uris.js";
import { jsonContents, orgFromUri, resourceError } from "./read.js";

export function registerMetrics28DayResource(server: McpServer): void {
    server.registerResource(
        "copilot_metrics_28_day",
        new ResourceTemplate(METRICS_28_DAY_TEMPLATE, {
            // Best-effort: with no token or a GitHub error this lists nothing instead of failing resources/list.
            list: async (ctx) => ({
                resources: (await listOrgLogins(ctx.mcpReq.signal)).map((org) => {
                    const { uri, name } = metrics28DayRef(org);
                    return { uri, name, title: name, mimeType: JSON_MIME };
                }),
            }),
            complete: { org: completeOrg },
        }),
        {
            title: "Copilot usage metrics, latest 28 days",
            description: "The latest 28-day usage-metrics report of one organization, summarised: the same data as get_copilot_metrics in JSON mode without `day`. `available: false` means GitHub has no report yet.",
            mimeType: JSON_MIME,
            cacheHint: { ttlMs: 3_600_000, cacheScope: "private" },
        },
        async (uri, variables, ctx) => {
            const org = orgFromUri(variables.org);
            try {
                return jsonContents(uri, await fetchMetrics(org, undefined, getToken(), ctx.mcpReq.signal));
            } catch (err: unknown) {
                throw resourceError(err, uri, metricsErrorMessage(err));
            }
        }
    );
}
