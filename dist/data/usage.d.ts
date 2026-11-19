import type { SeatBreakdown } from "./billing.js";
/**
 * One organization in the cross-org summary. `skipped` means no Copilot subscription, no access or insufficient
 * permissions; `failed` means a real error (rate limit, server error, network), which makes the totals incomplete.
 */
export type OrgUsage = {
    login: string;
    status: "ok";
    plan_type: string;
    seat_breakdown: SeatBreakdown;
} | {
    login: string;
    status: "skipped" | "failed";
    reason: string;
};
export interface UsageAllOrgsData {
    organizations_scanned: number;
    totals: {
        seats: number;
        active: number;
        inactive: number;
    };
    /** Successes, then skipped, then failed; each group keeps the order GitHub listed the orgs in. */
    organizations: OrgUsage[];
    skipped_count: number;
    failed_count: number;
    /** True when at least one org failed, so the totals do not cover every org. */
    incomplete: boolean;
}
/**
 * Fetch Copilot billing for every organization the token can see, at most 5 at a time. `onProgress` is called after each
 * org finishes and is awaited, so a slow consumer slows the scan instead of piling up.
 */
export declare function fetchUsageAllOrgs(token: string, signal?: AbortSignal, onProgress?: (done: number, total: number, login: string) => void | Promise<void>): Promise<UsageAllOrgsData>;
export declare function renderUsageMarkdown(data: UsageAllOrgsData): string;
//# sourceMappingURL=usage.d.ts.map