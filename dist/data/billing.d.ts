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
export declare function fetchBilling(org: string, token: string, signal?: AbortSignal): Promise<BillingData>;
export declare function renderBillingMarkdown(data: BillingData): string;
//# sourceMappingURL=billing.d.ts.map