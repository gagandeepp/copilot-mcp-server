import { ResourceTemplate } from "@modelcontextprotocol/server";
import type { McpServer } from "@modelcontextprotocol/server";
import { fetchBilling } from "../data/billing.js";
import { getToken } from "../github-client.js";
import { completeOrg, listOrgLogins } from "../org-completion.js";
import { BILLING_TEMPLATE, JSON_MIME, billingRef } from "../resource-uris.js";
import { jsonContents, orgFromUri, resourceError } from "./read.js";

export function registerBillingResource(server: McpServer): void {
    server.registerResource(
        "copilot_billing",
        new ResourceTemplate(BILLING_TEMPLATE, {
            // Best-effort: with no token or a GitHub error this lists nothing instead of failing resources/list.
            list: async (ctx) => ({
                resources: (await listOrgLogins(ctx.mcpReq.signal)).map((org) => {
                    const { uri, name } = billingRef(org);
                    return { uri, name, title: name, mimeType: JSON_MIME };
                }),
            }),
            complete: { org: completeOrg },
        }),
        {
            title: "Copilot billing summary",
            description: "Seat breakdown, plan and feature status of one organization: the same data as get_copilot_billing_summary in JSON mode.",
            mimeType: JSON_MIME,
            cacheHint: { ttlMs: 600_000, cacheScope: "private" },
        },
        async (uri, variables, ctx) => {
            const org = orgFromUri(variables.org);
            try {
                return jsonContents(uri, await fetchBilling(org, getToken(), ctx.mcpReq.signal));
            } catch (err: unknown) {
                throw resourceError(err, uri);
            }
        }
    );
}
