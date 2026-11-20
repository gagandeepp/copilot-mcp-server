import { ApiError } from "../github-client.js";
import { cell } from "../markdown.js";
import { fetchBilling } from "./billing.js";
import { fetchOrganizations } from "./organizations.js";
const MAX_CONCURRENT_ORGS = 5;
function classifyError(login, err) {
    // A rate-limited response (including a rate-limited 403) is a failure, not a permissions skip.
    if (err instanceof ApiError && err.rateLimited) {
        return { login, status: "failed", reason: `HTTP ${err.status} (rate limited)` };
    }
    if (err instanceof ApiError && err.status === 404) {
        return { login, status: "skipped", reason: "No Copilot subscription or no access" };
    }
    if (err instanceof ApiError && err.status === 403) {
        return {
            login,
            status: "skipped",
            reason: "Insufficient permissions (requires org owner with manage_billing:copilot or read:org)",
        };
    }
    if (err instanceof ApiError) {
        return { login, status: "failed", reason: `HTTP ${err.status}` };
    }
    return { login, status: "failed", reason: `request failed (${err instanceof Error ? err.message : String(err)})` };
}
/**
 * Fetch Copilot billing for every organization the token can see, at most 5 at a time. `onProgress` is called after each
 * org finishes and is awaited, so a slow consumer slows the scan instead of piling up.
 */
export async function fetchUsageAllOrgs(token, signal, onProgress) {
    const { organizations: orgs } = await fetchOrganizations(token, signal);
    const results = new Array(orgs.length);
    let nextOrg = 0;
    let done = 0;
    const worker = async () => {
        while (nextOrg < orgs.length && !signal?.aborted) {
            const index = nextOrg++;
            const { login } = orgs[index];
            try {
                const billing = await fetchBilling(login, token, signal);
                results[index] = { login, status: "ok", plan_type: billing.plan_type, seat_breakdown: billing.seat_breakdown };
            }
            catch (err) {
                // A cancelled request ends the whole call; it is not a per-org failure.
                if (signal?.aborted)
                    throw err;
                results[index] = classifyError(login, err);
            }
            done++;
            await onProgress?.(done, orgs.length, login);
        }
    };
    await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT_ORGS, orgs.length) }, worker));
    signal?.throwIfAborted();
    const ok = results.filter((r) => r.status === "ok");
    const skipped = results.filter((r) => r.status === "skipped");
    const failed = results.filter((r) => r.status === "failed");
    return {
        organizations_scanned: orgs.length,
        totals: {
            seats: ok.reduce((sum, r) => sum + r.seat_breakdown.total, 0),
            active: ok.reduce((sum, r) => sum + r.seat_breakdown.active_this_cycle, 0),
            inactive: ok.reduce((sum, r) => sum + r.seat_breakdown.inactive_this_cycle, 0),
        },
        organizations: [...ok, ...skipped, ...failed],
        skipped_count: skipped.length,
        failed_count: failed.length,
        incomplete: failed.length > 0,
    };
}
function orgRow(org) {
    if (org.status === "ok") {
        const sb = org.seat_breakdown;
        return (`| ${cell(org.login)} ` +
            `| ${cell(org.plan_type)} ` +
            `| ${sb.total} ` +
            `| ${sb.active_this_cycle} ` +
            `| ${sb.inactive_this_cycle} ` +
            `| ${sb.pending_cancellation} ` +
            `| ${sb.pending_invitation} |`);
    }
    const text = org.status === "failed"
        ? `Error: ${org.reason.replace(/[|\r\n]/g, " ")}`
        : org.reason;
    return `| ${cell(org.login)} | _${text}_ | — | — | — | — | — |`;
}
export function renderUsageMarkdown(data) {
    if (data.organizations_scanned === 0)
        return "No organizations found for the authenticated user.";
    const lines = [
        `## Copilot Usage Across All Organizations\n`,
        `| Org | Plan | Total Seats | Active | Inactive | Pending Cancel | Pending Invite |`,
        `|-----|------|-------------|--------|----------|----------------|----------------|`,
        ...data.organizations.map(orgRow),
    ];
    // Grand total
    lines.push(`\n### Grand Total`, `- Organizations scanned: ${data.organizations_scanned}`, `- Total Copilot seats: ${data.totals.seats}`, `- Total active users: ${data.totals.active}`, `- Total inactive users: ${data.totals.inactive}`);
    if (data.skipped_count > 0) {
        lines.push(`\n_Note: ${data.skipped_count} org(s) skipped (no Copilot subscription, no access, or insufficient permissions)._`);
    }
    if (data.failed_count > 0) {
        lines.push(`\n**Warning:** ${data.failed_count} org(s) failed with errors, so the totals above are incomplete. Retry later or check GITHUB_TOKEN.`);
    }
    return lines.join("\n");
}
//# sourceMappingURL=usage.js.map