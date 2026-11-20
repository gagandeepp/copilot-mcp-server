import { fetchOrganizations } from "./data/organizations.js";
import { getToken } from "./github-client.js";
const CACHE_TTL_MS = 5 * 60_000;
const MAX_SUGGESTIONS = 100;
// Module scope on purpose: one /user/orgs fetch serves every completion and resources/list for five minutes.
let cached;
/**
 * The org logins GITHUB_TOKEN can see, from a five-minute cache. Best-effort and never throws: no token or any API error
 * gives []. Failures are not cached, so the next call tries again. Completion callbacks have no request signal, so the
 * fetch is only bound to the caller's `signal` when one is given (and it is never shared between requests).
 */
export async function listOrgLogins(signal) {
    if (cached !== undefined && cached.expiresAt > Date.now())
        return cached.logins;
    try {
        const { organizations } = await fetchOrganizations(getToken(), signal);
        const logins = organizations.map((org) => org.login);
        cached = { logins, expiresAt: Date.now() + CACHE_TTL_MS };
        return logins;
    }
    catch {
        return [];
    }
}
/** Completion for an `org` argument or URI variable: logins starting with `value` (case-insensitive), at most 100. */
export async function completeOrg(value) {
    const prefix = value.toLowerCase();
    const logins = await listOrgLogins();
    return logins.filter((login) => login.toLowerCase().startsWith(prefix)).slice(0, MAX_SUGGESTIONS);
}
//# sourceMappingURL=org-completion.js.map