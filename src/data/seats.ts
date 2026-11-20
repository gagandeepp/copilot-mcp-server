import { githubFetch } from "../github-client.js";
import { cell } from "../markdown.js";
import type { CopilotSeatsResponse } from "../types.js";

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

export async function fetchSeats(
    org: string,
    page: number,
    perPage: number,
    token: string,
    signal?: AbortSignal
): Promise<SeatsData> {
    const data = await githubFetch<CopilotSeatsResponse>(
        `/orgs/${encodeURIComponent(org)}/copilot/billing/seats?per_page=${perPage}&page=${page}`,
        token,
        signal
    );

    const seats: SeatData[] = (data.seats ?? []).map((s) => ({
        login: s.assignee.login,
        type: s.assignee.type,
        team: s.assigning_team?.name || null,
        plan_type: s.plan_type,
        last_activity_at: s.last_activity_at || null,
        last_authenticated_at: s.last_authenticated_at || null,
        last_activity_editor: s.last_activity_editor || null,
        pending_cancellation_date: s.pending_cancellation_date || null,
        created_at: s.created_at,
    }));
    const hasMore = data.total_seats > page * perPage;

    return {
        org,
        page,
        per_page: perPage,
        total_seats: data.total_seats,
        count: seats.length,
        has_more: hasMore,
        ...(hasMore ? { next_page: page + 1 } : {}),
        seats,
    };
}

export function renderSeatsMarkdown(data: SeatsData): string {
    if (data.seats.length === 0) {
        return `No Copilot seats found for org "${data.org}" (page ${data.page}).`;
    }

    const header = `## Copilot Seats for **${data.org}** (Page ${data.page}, Total: ${data.total_seats})\n`;
    const tableHeader =
        `| User | Type | Team | Plan | Last Active | Last Auth | Last Editor | Pending Cancel |\n` +
        `|------|------|------|------|-------------|-----------|-------------|----------------|\n`;

    const rows = data.seats
        .map((s) => {
            return (
                `| ${cell(s.login)} ` +
                `| ${cell(s.type)} ` +
                `| ${cell(s.team ?? "—")} ` +
                `| ${cell(s.plan_type)} ` +
                `| ${s.last_activity_at ?? "Never"} ` +
                `| ${s.last_authenticated_at ?? "—"} ` +
                `| ${cell(s.last_activity_editor ?? "—")} ` +
                `| ${s.pending_cancellation_date ?? "—"} |`
            );
        })
        .join("\n");

    const pagination = data.has_more
        ? `\n\n_More seats available. Use page=${data.page + 1} (per_page=${data.per_page}) to see the next batch._`
        : "";

    return header + tableHeader + rows + pagination;
}
