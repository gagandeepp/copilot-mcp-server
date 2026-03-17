import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getToken, githubFetch } from "../github-client.js";
import type { CopilotSeatsResponse } from "../types.js";

export function registerGetCopilotSeats(server: McpServer): void {
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
}
