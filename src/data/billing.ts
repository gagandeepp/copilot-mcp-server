import { githubFetch } from "../github-client.js";
import type { CopilotBilling } from "../types.js";

export interface SeatBreakdown {
    total: number;
    added_this_cycle: number;
    pending_cancellation: number;
    pending_invitation: number;
    active_this_cycle: number;
    inactive_this_cycle: number;
}

export interface BillingData {
    org: string;
    plan_type: string;
    seat_management_setting: string;
    seat_breakdown: SeatBreakdown;
    features: {
        public_code_suggestions: string;
        ide_chat: string;
        platform_chat: string;
        cli: string;
    };
}

export async function fetchBilling(org: string, token: string, signal?: AbortSignal): Promise<BillingData> {
    const billing = await githubFetch<CopilotBilling>(
        `/orgs/${encodeURIComponent(org)}/copilot/billing`,
        token,
        signal
    );
    const sb = billing.seat_breakdown;
    return {
        org,
        plan_type: billing.plan_type,
        seat_management_setting: billing.seat_management_setting,
        seat_breakdown: {
            total: sb.total,
            added_this_cycle: sb.added_this_cycle,
            pending_cancellation: sb.pending_cancellation,
            pending_invitation: sb.pending_invitation,
            active_this_cycle: sb.active_this_cycle,
            inactive_this_cycle: sb.inactive_this_cycle,
        },
        features: {
            public_code_suggestions: billing.public_code_suggestions,
            ide_chat: billing.ide_chat,
            platform_chat: billing.platform_chat,
            cli: billing.cli,
        },
    };
}

export function renderBillingMarkdown(data: BillingData): string {
    const sb = data.seat_breakdown;
    const features = data.features;
    return [
        `## Copilot Billing Summary for **${data.org}**\n`,
        `**Plan type:** ${data.plan_type}`,
        `**Seat management:** ${data.seat_management_setting}\n`,
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
        `| Public code suggestions | ${features.public_code_suggestions} |`,
        `| IDE Chat | ${features.ide_chat} |`,
        `| Platform Chat | ${features.platform_chat} |`,
        `| CLI | ${features.cli} |`,
    ].join("\n");
}
