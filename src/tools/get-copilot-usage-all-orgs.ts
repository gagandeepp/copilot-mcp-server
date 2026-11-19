import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiError, getToken, githubFetch, githubFetchAll } from "../github-client.js";
import type { GitHubOrg, CopilotBilling } from "../types.js";

export function registerGetCopilotUsageAllOrgs(server: McpServer): void {
    server.registerTool(
        "get_copilot_usage_all_orgs",
        {
            description: "Get a high-level Copilot usage summary across ALL organizations the authenticated user belongs to. Shows seat counts and active users per org in a single view.",
            inputSchema: {},
        },
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
                const skipped: string[] = [];
                const failed: string[] = [];

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
                    } catch (err: unknown) {
                        if (err instanceof ApiError && err.status === 404) {
                            skipped.push(
                                `| ${org.login} | _No Copilot subscription or no access_ | — | — | — | — | — |`
                            );
                        } else if (err instanceof ApiError && err.status === 403) {
                            skipped.push(
                                `| ${org.login} | _Insufficient permissions (requires org owner with manage_billing:copilot or read:org)_ | — | — | — | — | — |`
                            );
                        } else if (err instanceof ApiError) {
                            failed.push(
                                `| ${org.login} | _Error: HTTP ${err.status}_ | — | — | — | — | — |`
                            );
                        } else {
                            const message = (err instanceof Error ? err.message : String(err)).replace(/[|\r\n]/g, " ");
                            failed.push(
                                `| ${org.login} | _Error: request failed (${message})_ | — | — | — | — | — |`
                            );
                        }
                    }
                }

                // Add error rows
                lines.push(...skipped, ...failed);

                // Grand total
                lines.push(
                    `\n### Grand Total`,
                    `- Organizations scanned: ${orgs.length}`,
                    `- Total Copilot seats: ${totalSeats}`,
                    `- Total active users: ${totalActive}`,
                    `- Total inactive users: ${totalInactive}`
                );

                if (skipped.length > 0) {
                    lines.push(
                        `\n_Note: ${skipped.length} org(s) skipped (no Copilot subscription, no access, or insufficient permissions)._`
                    );
                }

                if (failed.length > 0) {
                    lines.push(
                        `\n**Warning:** ${failed.length} org(s) failed with errors, so the totals above are incomplete. Retry later or check GITHUB_TOKEN.`
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
