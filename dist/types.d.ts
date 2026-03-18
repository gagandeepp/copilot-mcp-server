export interface GitHubOrg {
    login: string;
    id: number;
    description: string | null;
    url: string;
}
export interface CopilotBilling {
    seat_breakdown: {
        total: number;
        added_this_cycle: number;
        pending_cancellation: number;
        pending_invitation: number;
        active_this_cycle: number;
        inactive_this_cycle: number;
    };
    seat_management_setting: string;
    public_code_suggestions: string;
    ide_chat: string;
    platform_chat: string;
    cli: string;
    plan_type: string;
}
export interface CopilotSeatDetail {
    assignee: {
        login: string;
        id: number;
        avatar_url: string;
        type: string;
    };
    assigning_team: {
        name: string;
        id: number;
    } | null;
    created_at: string;
    updated_at: string;
    last_activity_at: string | null;
    last_activity_editor: string | null;
    pending_cancellation_date: string | null;
    plan_type: string;
}
export interface CopilotSeatsResponse {
    total_seats: number;
    seats: CopilotSeatDetail[];
}
export interface CopilotMetricDay {
    date: string;
    total_active_users: number;
    total_engaged_users: number;
    copilot_ide_code_completions?: {
        total_engaged_users: number;
        editors?: Array<{
            name: string;
            total_engaged_users: number;
            models?: Array<{
                name: string;
                total_engaged_users: number;
                total_code_acceptances: number;
                total_code_suggestions: number;
                total_code_lines_accepted: number;
                total_code_lines_suggested: number;
            }>;
        }>;
    };
    copilot_ide_chat?: {
        total_engaged_users: number;
        editors?: Array<{
            name: string;
            total_engaged_users: number;
            models?: Array<{
                name: string;
                total_engaged_users: number;
                total_chats: number;
            }>;
        }>;
    };
    copilot_dotcom_chat?: {
        total_engaged_users: number;
        models?: Array<{
            name: string;
            total_engaged_users: number;
            total_chats: number;
        }>;
    };
    copilot_dotcom_pull_requests?: {
        total_engaged_users: number;
    };
}
//# sourceMappingURL=types.d.ts.map