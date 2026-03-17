#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// GitHub API helpers
// ---------------------------------------------------------------------------

const GITHUB_API = "https://api.github.com";

function getToken(): string {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
        throw new Error(
            "GITHUB_TOKEN environment variable is not set. " +
            "Please set it to a GitHub personal access token with " +
            "'manage_billing:copilot', 'read:org' scopes."
        );
    }
    return token;
}

async function githubFetch<T>(path: string, token: string): Promise<T> {
    const url = path.startsWith("http") ? path : `${GITHUB_API}${path}`;
    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`GitHub API error ${res.status}: ${body}`);
    }

    return res.json() as Promise<T>;
}

/** Paginate through all pages of a GitHub list endpoint */
async function githubFetchAll<T>(path: string, token: string): Promise<T[]> {
    const items: T[] = [];
    let url: string | null = path.startsWith("http")
        ? path
        : `${GITHUB_API}${path}`;

    while (url) {
        const res: Response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        });

        if (!res.ok) {
            const body = await res.text();
            throw new Error(`GitHub API error ${res.status}: ${body}`);
        }

        const data = (await res.json()) as T[];
        items.push(...data);

        // Parse Link header for next page
        const link: string | null = res.headers.get("link");
        url = null;
        if (link) {
            const match: RegExpMatchArray | null = link.match(/<([^>]+)>;\s*rel="next"/);
            if (match) url = match[1];
        }
    }

    return items;
}

// ---------------------------------------------------------------------------
// TypeScript interfaces for GitHub API responses
// ---------------------------------------------------------------------------

interface GitHubOrg {
    login: string;
    id: number;
    description: string | null;
    url: string;
}

interface CopilotBilling {
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

interface CopilotSeatDetail {
    assignee: {
        login: string;
        id: number;
        avatar_url: string;
        type: string;
    };
    assigning_team: { name: string; id: number } | null;
    created_at: string;
    updated_at: string;
    last_activity_at: string | null;
    last_activity_editor: string | null;
    pending_cancellation_date: string | null;
    plan_type: string;
}

interface CopilotSeatsResponse {
    total_seats: number;
    seats: CopilotSeatDetail[];
}

interface CopilotMetricDay {
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

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
    name: "github-copilot-usage",
    version: "1.0.0",
});

// ── Tool 1: List organizations ──────────────────────────────────────────────

server.tool(
    "list_organizations",
    "List all GitHub organizations the authenticated user belongs to, with their IDs. Use the org login (slug) for subsequent Copilot queries.",
    {},
    async () => {
        try {
            const token = getToken();
            const orgs = await githubFetchAll<GitHubOrg>("/user/orgs?per_page=100", token);

            if (orgs.length === 0) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: "No organizations found for the authenticated user.",
                        },
                    ],
                };
            }

            const table = orgs.map((o) => ({
                id: o.id,
                login: o.login,
                description: o.description || "",
            }));

            return {
                content: [
                    {
                        type: "text" as const,
                        text:
                            `Found ${orgs.length} organization(s):\n\n` +
                            `| ID | Login (use this as org) | Description |\n` +
                            `|----|------------------------|-------------|\n` +
                            table
                                .map((r) => `| ${r.id} | ${r.login} | ${r.description} |`)
                                .join("\n"),
                    },
                ],
            };
        } catch (err: unknown) {
            return {
                content: [
                    { type: "text" as const, text: `Error: ${(err as Error).message}` },
                ],
                isError: true,
            };
        }
    }
);

// ── Tool 2: Get Copilot billing / seat summary for an org ───────────────────

server.tool(
    "get_copilot_billing_summary",
    "Get the Copilot billing summary for an organization, including total seats, active/inactive breakdown, plan type, and feature enablement status.",
    {
        org: z.string().describe("GitHub organization login (slug), e.g. 'my-company'"),
    },
    async ({ org }) => {
        try {
            const token = getToken();
            const billing = await githubFetch<CopilotBilling>(
                `/orgs/${encodeURIComponent(org)}/copilot/billing`,
                token
            );

            const sb = billing.seat_breakdown;
            const summary = [
                `## Copilot Billing Summary for **${org}**\n`,
                `**Plan type:** ${billing.plan_type}`,
                `**Seat management:** ${billing.seat_management_setting}\n`,
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
                `| Public code suggestions | ${billing.public_code_suggestions} |`,
                `| IDE Chat | ${billing.ide_chat} |`,
                `| Platform Chat | ${billing.platform_chat} |`,
                `| CLI | ${billing.cli} |`,
            ];

            return {
                content: [{ type: "text" as const, text: summary.join("\n") }],
            };
        } catch (err: unknown) {
            return {
                content: [
                    { type: "text" as const, text: `Error: ${(err as Error).message}` },
                ],
                isError: true,
            };
        }
    }
);

// ── Tool 3: Get Copilot seat details (per-user) ────────────────────────────

server.tool(
    "get_copilot_seats",
    "List all Copilot seat assignments for an organization with per-user details including last activity date, editor used, team, and plan type.",
    {
        org: z.string().describe("GitHub organization login (slug)"),
        page: z
            .number()
            .optional()
            .default(1)
            .describe("Page number (50 seats per page)"),
    },
    async ({ org, page }) => {
        try {
            const token = getToken();
            const data = await githubFetch<CopilotSeatsResponse>(
                `/orgs/${encodeURIComponent(org)}/copilot/billing/seats?per_page=50&page=${page}`,
                token
            );

            if (!data.seats || data.seats.length === 0) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `No Copilot seats found for org "${org}" (page ${page}).`,
                        },
                    ],
                };
            }

            const header = `## Copilot Seats for **${org}** (Page ${page}, Total: ${data.total_seats})\n`;
            const tableHeader =
                `| User | Type | Team | Plan | Last Active | Last Editor | Pending Cancel |\n` +
                `|------|------|------|------|-------------|-------------|----------------|\n`;

            const rows = data.seats
                .map((s) => {
                    return (
                        `| ${s.assignee.login} ` +
                        `| ${s.assignee.type} ` +
                        `| ${s.assigning_team?.name || "—"} ` +
                        `| ${s.plan_type} ` +
                        `| ${s.last_activity_at || "Never"} ` +
                        `| ${s.last_activity_editor || "—"} ` +
                        `| ${s.pending_cancellation_date || "—"} |`
                    );
                })
                .join("\n");

            const pagination =
                data.total_seats > page * 50
                    ? `\n\n_More seats available. Use page=${page + 1} to see next batch._`
                    : "";

            return {
                content: [
                    {
                        type: "text" as const,
                        text: header + tableHeader + rows + pagination,
                    },
                ],
            };
        } catch (err: unknown) {
            return {
                content: [
                    { type: "text" as const, text: `Error: ${(err as Error).message}` },
                ],
                isError: true,
            };
        }
    }
);

// ── Tool 4: Get Copilot usage metrics (aggregated) ─────────────────────────

server.tool(
    "get_copilot_metrics",
    "Get aggregated Copilot usage metrics for an organization over recent days, including code completions, chat usage, and active/engaged user counts broken down by editor and model.",
    {
        org: z.string().describe("GitHub organization login (slug)"),
        since: z
            .string()
            .optional()
            .describe("Start date in YYYY-MM-DD format (defaults to 28 days ago)"),
        until: z
            .string()
            .optional()
            .describe("End date in YYYY-MM-DD format (defaults to yesterday)"),
    },
    async ({ org, since, until }) => {
        try {
            const token = getToken();

            let path = `/orgs/${encodeURIComponent(org)}/copilot/metrics?per_page=28`;
            if (since) path += `&since=${since}`;
            if (until) path += `&until=${until}`;

            const metrics = await githubFetch<CopilotMetricDay[]>(path, token);

            if (!metrics || metrics.length === 0) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `No Copilot metrics found for org "${org}" in the specified date range.`,
                        },
                    ],
                };
            }

            const lines: string[] = [
                `## Copilot Usage Metrics for **${org}**`,
                `_Showing ${metrics.length} day(s) of data_\n`,
                `| Date | Active Users | Engaged Users | Completions Users | Chat (IDE) Users | Chat (Web) Users | PR Users |`,
                `|------|-------------|---------------|-------------------|------------------|------------------|----------|`,
            ];

            for (const day of metrics) {
                lines.push(
                    `| ${day.date} ` +
                    `| ${day.total_active_users} ` +
                    `| ${day.total_engaged_users} ` +
                    `| ${day.copilot_ide_code_completions?.total_engaged_users ?? "—"} ` +
                    `| ${day.copilot_ide_chat?.total_engaged_users ?? "—"} ` +
                    `| ${day.copilot_dotcom_chat?.total_engaged_users ?? "—"} ` +
                    `| ${day.copilot_dotcom_pull_requests?.total_engaged_users ?? "—"} |`
                );
            }

            // Summary statistics
            const totalActive = metrics.reduce(
                (sum, d) => Math.max(sum, d.total_active_users),
                0
            );
            const totalEngaged = metrics.reduce(
                (sum, d) => Math.max(sum, d.total_engaged_users),
                0
            );
            const avgActive = (
                metrics.reduce((sum, d) => sum + d.total_active_users, 0) /
                metrics.length
            ).toFixed(1);
            const avgEngaged = (
                metrics.reduce((sum, d) => sum + d.total_engaged_users, 0) /
                metrics.length
            ).toFixed(1);

            lines.push(
                `\n### Summary`,
                `- Peak active users: ${totalActive}`,
                `- Peak engaged users: ${totalEngaged}`,
                `- Average daily active users: ${avgActive}`,
                `- Average daily engaged users: ${avgEngaged}`
            );

            // Editor breakdown from latest day
            const latest = metrics[metrics.length - 1];
            if (latest.copilot_ide_code_completions?.editors) {
                lines.push(`\n### Editor Breakdown (latest day: ${latest.date})`);
                lines.push(`| Editor | Engaged Users |`);
                lines.push(`|--------|---------------|`);
                for (const editor of latest.copilot_ide_code_completions.editors) {
                    lines.push(`| ${editor.name} | ${editor.total_engaged_users} |`);
                }
            }

            return {
                content: [{ type: "text" as const, text: lines.join("\n") }],
            };
        } catch (err: unknown) {
            return {
                content: [
                    { type: "text" as const, text: `Error: ${(err as Error).message}` },
                ],
                isError: true,
            };
        }
    }
);

// ── Tool 5: Get Copilot usage across ALL orgs at once ──────────────────────

server.tool(
    "get_copilot_usage_all_orgs",
    "Get a high-level Copilot usage summary across ALL organizations the authenticated user belongs to. Shows seat counts and active users per org in a single view.",
    {},
    async () => {
        try {
            const token = getToken();
            const orgs = await githubFetchAll<GitHubOrg>("/user/orgs?per_page=100", token);

            if (orgs.length === 0) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: "No organizations found for the authenticated user.",
                        },
                    ],
                };
            }

            const lines: string[] = [
                `## Copilot Usage Across All Organizations\n`,
                `| Org | Plan | Total Seats | Active | Inactive | Pending Cancel | Pending Invite |`,
                `|-----|------|-------------|--------|----------|----------------|----------------|`,
            ];

            let totalSeats = 0;
            let totalActive = 0;
            let totalInactive = 0;
            const errors: string[] = [];

            for (const org of orgs) {
                try {
                    const billing = await githubFetch<CopilotBilling>(
                        `/orgs/${encodeURIComponent(org.login)}/copilot/billing`,
                        token
                    );
                    const sb = billing.seat_breakdown;
                    totalSeats += sb.total;
                    totalActive += sb.active_this_cycle;
                    totalInactive += sb.inactive_this_cycle;

                    lines.push(
                        `| ${org.login} ` +
                        `| ${billing.plan_type} ` +
                        `| ${sb.total} ` +
                        `| ${sb.active_this_cycle} ` +
                        `| ${sb.inactive_this_cycle} ` +
                        `| ${sb.pending_cancellation} ` +
                        `| ${sb.pending_invitation} |`
                    );
                } catch {
                    errors.push(
                        `| ${org.login} | _No Copilot subscription or insufficient permissions_ | — | — | — | — | — |`
                    );
                }
            }

            // Add error rows
            lines.push(...errors);

            // Grand total
            lines.push(
                `\n### Grand Total`,
                `- Organizations scanned: ${orgs.length}`,
                `- Total Copilot seats: ${totalSeats}`,
                `- Total active users: ${totalActive}`,
                `- Total inactive users: ${totalInactive}`
            );

            if (errors.length > 0) {
                lines.push(
                    `\n_Note: ${errors.length} org(s) had no Copilot subscription or returned errors._`
                );
            }

            return {
                content: [{ type: "text" as const, text: lines.join("\n") }],
            };
        } catch (err: unknown) {
            return {
                content: [
                    { type: "text" as const, text: `Error: ${(err as Error).message}` },
                ],
                isError: true,
            };
        }
    }
);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("GitHub Copilot Usage MCP server running on stdio");
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});