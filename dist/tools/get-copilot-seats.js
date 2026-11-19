import * as z from "zod/v4";
import { getToken, githubFetch } from "../github-client.js";
import { orgLogin } from "../schemas.js";
export function registerGetCopilotSeats(server) {
    server.registerTool("get_copilot_seats", {
        title: "Copilot Seat Assignments",
        description: "List all Copilot seat assignments for an organization with per-user details including last activity date, editor used, team, and plan type.",
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
        },
        inputSchema: z.strictObject({
            org: orgLogin.describe("GitHub organization login (slug)"),
            page: z
                .number()
                .int()
                .min(1)
                .default(1)
                .describe("Page number, starting at 1"),
            per_page: z
                .number()
                .int()
                .min(1)
                .max(100)
                .default(50)
                .describe("Seats per page (1-100, default 50)"),
        }),
    }, async ({ org, page, per_page }, ctx) => {
        try {
            const token = getToken();
            const data = await githubFetch(`/orgs/${encodeURIComponent(org)}/copilot/billing/seats?per_page=${per_page}&page=${page}`, token, ctx.mcpReq.signal);
            if (!data.seats || data.seats.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `No Copilot seats found for org "${org}" (page ${page}).`,
                        },
                    ],
                };
            }
            const header = `## Copilot Seats for **${org}** (Page ${page}, Total: ${data.total_seats})\n`;
            const tableHeader = `| User | Type | Team | Plan | Last Active | Last Auth | Last Editor | Pending Cancel |\n` +
                `|------|------|------|------|-------------|-----------|-------------|----------------|\n`;
            const rows = data.seats
                .map((s) => {
                return (`| ${s.assignee.login} ` +
                    `| ${s.assignee.type} ` +
                    `| ${s.assigning_team?.name || "—"} ` +
                    `| ${s.plan_type} ` +
                    `| ${s.last_activity_at || "Never"} ` +
                    `| ${s.last_authenticated_at || "—"} ` +
                    `| ${s.last_activity_editor || "—"} ` +
                    `| ${s.pending_cancellation_date || "—"} |`);
            })
                .join("\n");
            const pagination = data.total_seats > page * per_page
                ? `\n\n_More seats available. Use page=${page + 1} (per_page=${per_page}) to see the next batch._`
                : "";
            return {
                content: [
                    {
                        type: "text",
                        text: header + tableHeader + rows + pagination,
                    },
                ],
            };
        }
        catch (err) {
            return {
                content: [
                    { type: "text", text: `Error: ${err.message}` },
                ],
                isError: true,
            };
        }
    });
}
//# sourceMappingURL=get-copilot-seats.js.map