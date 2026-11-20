/**
 * The org logins GITHUB_TOKEN can see, from a five-minute cache. Best-effort and never throws: no token or any API error
 * gives []. Failures are not cached, so the next call tries again. Completion callbacks have no request signal, so the
 * fetch is only bound to the caller's `signal` when one is given (and it is never shared between requests).
 */
export declare function listOrgLogins(signal?: AbortSignal): Promise<string[]>;
/** Completion for an `org` argument or URI variable: logins starting with `value` (case-insensitive), at most 100. */
export declare function completeOrg(value: string): Promise<string[]>;
//# sourceMappingURL=org-completion.d.ts.map