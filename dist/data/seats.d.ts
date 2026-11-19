export interface SeatData {
    login: string;
    type: string;
    team: string | null;
    plan_type: string;
    last_activity_at: string | null;
    last_authenticated_at: string | null;
    last_activity_editor: string | null;
    pending_cancellation_date: string | null;
    created_at: string;
}
export interface SeatsData {
    org: string;
    page: number;
    per_page: number;
    total_seats: number;
    /** Seats on this page. */
    count: number;
    has_more: boolean;
    /** Present only when `has_more` is true. */
    next_page?: number;
    seats: SeatData[];
}
export declare function fetchSeats(org: string, page: number, perPage: number, token: string, signal?: AbortSignal): Promise<SeatsData>;
export declare function renderSeatsMarkdown(data: SeatsData): string;
//# sourceMappingURL=seats.d.ts.map