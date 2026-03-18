import { getToken, githubFetch, githubFetchAll } from "../github-client.js";
export function registerGetCopilotUsageAllOrgs(server) {
    server.registerTool("get_copilot_usage_all_orgs", {
        description: "Get a high-level Copilot usage summary across ALL organizations the authenticated user belongs to. Shows seat counts and active users per org in a single view.",
        inputSchema: {},
    }, async () => {
        try {
            const token = getToken();
            const orgs = await githubFetchAll("/user/orgs?per_page=100", token);
            if (orgs.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: "No organizations found for the authenticated user.",
                        },
                    ],
                };
            }
            const lines = [
                `## Copilot Usage Across All Organizations\n`,
                `| Org | Plan | Total Seats | Active | Inactive | Pending Cancel | Pending Invite |`,
                `|-----|------|-------------|--------|----------|----------------|----------------|`,
            ];
            let totalSeats = 0;
            let totalActive = 0;
            let totalInactive = 0;
            const errors = [];
            for (const org of orgs) {
                try {
                    const billing = await githubFetch(`/orgs/${encodeURIComponent(org.login)}/copilot/billing`, token);
                    const sb = billing.seat_breakdown;
                    totalSeats += sb.total;
                    totalActive += sb.active_this_cycle;
                    totalInactive += sb.inactive_this_cycle;
                    lines.push(`| ${org.login} ` +
                        `| ${billing.plan_type} ` +
                        `| ${sb.total} ` +
                        `| ${sb.active_this_cycle} ` +
                        `| ${sb.inactive_this_cycle} ` +
                        `| ${sb.pending_cancellation} ` +
                        `| ${sb.pending_invitation} |`);
                }
                catch {
                    errors.push(`| ${org.login} | _No Copilot subscription or insufficient permissions_ | — | — | — | — | — |`);
                }
            }
            // Add error rows
            lines.push(...errors);
            // Grand total
            lines.push(`\n### Grand Total`, `- Organizations scanned: ${orgs.length}`, `- Total Copilot seats: ${totalSeats}`, `- Total active users: ${totalActive}`, `- Total inactive users: ${totalInactive}`);
            if (errors.length > 0) {
                lines.push(`\n_Note: ${errors.length} org(s) had no Copilot subscription or returned errors._`);
            }
            return {
                content: [{ type: "text", text: lines.join("\n") }],
            };
        }
        catch (err) {
            return {
                content: [
                    { type: "text", text: `Error: ${err.message}` },
                ],
                isError: true,
            };
        }
    });
}
//# sourceMappingURL=get-copilot-usage-all-orgs.js.map