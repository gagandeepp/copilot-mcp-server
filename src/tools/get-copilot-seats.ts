import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { fetchSeats, renderSeatsMarkdown } from "../data/seats.js";
import { getToken } from "../github-client.js";
import { orgLogin, responseFormat } from "../schemas.js";
import { errorResult, formatResult } from "./result.js";

export function registerGetCopilotSeats(server: McpServer): void {
    server.registerTool(
        "get_copilot_seats",
        {
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
                response_format: responseFormat,
            }),
        },
        async ({ org, page, per_page, response_format }, ctx) => {
            try {
                const data = await fetchSeats(org, page, per_page, getToken(), ctx.mcpReq.signal);
                return formatResult(data, response_format, renderSeatsMarkdown);
            } catch (err: unknown) {
                return errorResult((err as Error).message);
            }
        }
    );
}
