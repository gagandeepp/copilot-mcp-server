import { ApiError, getToken, githubFetch, githubFetchAll } from "../github-client.js";
const MAX_CONCURRENT_ORGS = 5;
function errorRow(login, err) {
    // A rate-limited response (including a rate-limited 403) is a failure, not a permissions skip.
    if (err instanceof ApiError && err.rateLimited) {
        return { kind: "failed", row: `| ${login} | _Error: HTTP ${err.status} (rate limited)_ | — | — | — | — | — |` };
    }
    if (err instanceof ApiError && err.status === 404) {
        return { kind: "skipped", row: `| ${login} | _No Copilot subscription or no access_ | — | — | — | — | — |` };
    }
    if (err instanceof ApiError && err.status === 403) {
        return {
            kind: "skipped",
            row: `| ${login} | _Insufficient permissions (requires org owner with manage_billing:copilot or read:org)_ | — | — | — | — | — |`,
        };
    }
    if (err instanceof ApiError) {
        return { kind: "failed", row: `| ${login} | _Error: HTTP ${err.status}_ | — | — | — | — | — |` };
    }
    const message = (err instanceof Error ? err.message : String(err)).replace(/[|\r\n]/g, " ");
    return { kind: "failed", row: `| ${login} | _Error: request failed (${message})_ | — | — | — | — | — |` };
}
export function registerGetCopilotUsageAllOrgs(server) {
    server.registerTool("get_copilot_usage_all_orgs", {
        title: "Copilot Usage Across All Orgs",
        description: "Get a high-level Copilot usage summary across ALL organizations the authenticated user belongs to. Shows seat counts and active users per org in a single view.",
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
        },
    }, async (ctx) => {
        try {
            const token = getToken();
            const signal = ctx.mcpReq.signal;
            const orgs = await githubFetchAll("/user/orgs?per_page=100", token, signal);
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
            const results = new Array(orgs.length);
            const progressToken = ctx.mcpReq._meta?.progressToken;
            let nextOrg = 0;
            let done = 0;
            const worker = async () => {
                while (nextOrg < orgs.length && !signal.aborted) {
                    const index = nextOrg++;
                    const org = orgs[index];
                    try {
                        const billing = await githubFetch(`/orgs/${encodeURIComponent(org.login)}/copilot/billing`, token, signal);
                        const sb = billing.seat_breakdown;
                        totalSeats += sb.total;
                        totalActive += sb.active_this_cycle;
                        totalInactive += sb.inactive_this_cycle;
                        results[index] = {
                            kind: "ok",
                            row: `| ${org.login} ` +
                                `| ${billing.plan_type} ` +
                                `| ${sb.total} ` +
                                `| ${sb.active_this_cycle} ` +
                                `| ${sb.inactive_this_cycle} ` +
                                `| ${sb.pending_cancellation} ` +
                                `| ${sb.pending_invitation} |`,
                        };
                    }
                    catch (err) {
                        // A cancelled request ends the whole call; it is not a per-org failure.
                        if (signal.aborted)
                            throw err;
                        results[index] = errorRow(org.login, err);
                    }
                    done++;
                    if (progressToken !== undefined) {
                        // Progress is best-effort: a failed notification must not fail the tool call.
                        await ctx.mcpReq
                            .notify({
                            method: "notifications/progress",
                            params: { progressToken, progress: done, total: orgs.length, message: org.login },
                        })
                            .catch(() => { });
                    }
                }
            };
            await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT_ORGS, orgs.length) }, worker));
            signal.throwIfAborted();
            // Rows keep the original org order within each group: successes, then skipped, then failed.
            const rowsOf = (kind) => results.filter((r) => r.kind === kind).map((r) => r.row);
            const skipped = rowsOf("skipped");
            const failed = rowsOf("failed");
            lines.push(...rowsOf("ok"), ...skipped, ...failed);
            // Grand total
            lines.push(`\n### Grand Total`, `- Organizations scanned: ${orgs.length}`, `- Total Copilot seats: ${totalSeats}`, `- Total active users: ${totalActive}`, `- Total inactive users: ${totalInactive}`);
            if (skipped.length > 0) {
                lines.push(`\n_Note: ${skipped.length} org(s) skipped (no Copilot subscription, no access, or insufficient permissions)._`);
            }
            if (failed.length > 0) {
                lines.push(`\n**Warning:** ${failed.length} org(s) failed with errors, so the totals above are incomplete. Retry later or check GITHUB_TOKEN.`);
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