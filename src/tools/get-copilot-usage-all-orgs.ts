import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getToken, githubFetch, githubFetchAll } from "../github-client.js";
import type { GitHubOrg, CopilotBilling } from "../types.js";

export function registerGetCopilotUsageAllOrgs(server: McpServer): void {
    server.tool(
        "get_copilot_usage_all_orgs",
        "Get a high-level Copilot usage summary across ALL organizations the authenticated user belongs to. Shows seat counts and active users per org in a single view.",
        {},
        async () => {
            try {
                const token = getToken();
                const orgs = await githubFetchAll<GitHubOrg>("/user/orgs?per_page=100", token);

                if (orgs.length === 0) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: "No organizations found for the authenticated user.",
                            },
                        ],
                    };
                }

                const lines: string[] = [
                    `## Copilot Usage Across All Organizations\n`,
                    `| Org | Plan | Total Seats | Active | Inactive | Pending Cancel | Pending Invite |`,
                    `|-----|------|-------------|--------|----------|----------------|----------------|`,
                ];

                let totalSeats = 0;
                let totalActive = 0;
                let totalInactive = 0;
                const errors: string[] = [];

                for (const org of orgs) {
                    try {
                        const billing = await githubFetch<CopilotBilling>(
                            `/orgs/${encodeURIComponent(org.login)}/copilot/billing`,
                            token
                        );
                        const sb = billing.seat_breakdown;
                        totalSeats += sb.total;
                        totalActive += sb.active_this_cycle;
                        totalInactive += sb.inactive_this_cycle;

                        lines.push(
                            `| ${org.login} ` +
                            `| ${billing.plan_type} ` +
                            `| ${sb.total} ` +
                            `| ${sb.active_this_cycle} ` +
                            `| ${sb.inactive_this_cycle} ` +
                            `| ${sb.pending_cancellation} ` +
                            `| ${sb.pending_invitation} |`
                        );
                    } catch {
                        errors.push(
                            `| ${org.login} | _No Copilot subscription or insufficient permissions_ | — | — | — | — | — |`
                        );
                    }
                }

                // Add error rows
                lines.push(...errors);

                // Grand total
                lines.push(
                    `\n### Grand Total`,
                    `- Organizations scanned: ${orgs.length}`,
                    `- Total Copilot seats: ${totalSeats}`,
                    `- Total active users: ${totalActive}`,
                    `- Total inactive users: ${totalInactive}`
                );

                if (errors.length > 0) {
                    lines.push(
                        `\n_Note: ${errors.length} org(s) had no Copilot subscription or returned errors._`
                    );
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
