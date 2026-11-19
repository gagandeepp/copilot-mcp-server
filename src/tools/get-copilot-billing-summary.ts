import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { getToken, githubFetch } from "../github-client.js";
import type { CopilotBilling } from "../types.js";

export function registerGetCopilotBillingSummary(server: McpServer): void {
    server.registerTool(
        "get_copilot_billing_summary",
        {
            description: "Get the Copilot billing summary for an organization, including total seats, active/inactive breakdown, plan type, and feature enablement status.",
            inputSchema: z.strictObject({
                org: z.string().describe("GitHub organization login (slug), e.g. 'my-company'"),
            }),
        },
        async ({ org }) => {
            try {
                const token = getToken();
                const billing = await githubFetch<CopilotBilling>(
                    `/orgs/${encodeURIComponent(org)}/copilot/billing`,
                    token
                );

                const sb = billing.seat_breakdown;
                const summary = [
                    `## Copilot Billing Summary for **${org}**\n`,
                    `**Plan type:** ${billing.plan_type}`,
                    `**Seat management:** ${billing.seat_management_setting}\n`,
                    `### Seat Breakdown`,
                    `| Metric | Count |`,
                    `|--------|-------|`,
                    `| Total seats | ${sb.total} |`,
                    `| Active this cycle | ${sb.active_this_cycle} |`,
                    `| Inactive this cycle | ${sb.inactive_this_cycle} |`,
                    `| Added this cycle | ${sb.added_this_cycle} |`,
                    `| Pending cancellation | ${sb.pending_cancellation} |`,
                    `| Pending invitation | ${sb.pending_invitation} |\n`,
                    `### Feature Status`,
                    `| Feature | Status |`,
                    `|---------|--------|`,
                    `| Public code suggestions | ${billing.public_code_suggestions} |`,
                    `| IDE Chat | ${billing.ide_chat} |`,
                    `| Platform Chat | ${billing.platform_chat} |`,
                    `| CLI | ${billing.cli} |`,
                ];

                return {
                    content: [{ type: "text" as const, text: summary.join("\n") }],
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
