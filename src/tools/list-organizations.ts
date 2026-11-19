import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { fetchOrganizations, renderOrganizationsMarkdown } from "../data/organizations.js";
import { getToken } from "../github-client.js";
import { responseFormat } from "../schemas.js";
import { errorResult, formatResult } from "./result.js";

export function registerListOrganizations(server: McpServer): void {
    server.registerTool(
        "list_organizations",
        {
            title: "List Organizations",
            description: "List all GitHub organizations the authenticated user belongs to, with their IDs. Use the org login (slug) for subsequent Copilot queries.",
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: true,
            },
            inputSchema: z.strictObject({
                response_format: responseFormat,
            }),
        },
        async ({ response_format }, ctx) => {
            try {
                const data = await fetchOrganizations(getToken(), ctx.mcpReq.signal);
                return formatResult(data, response_format, renderOrganizationsMarkdown);
            } catch (err: unknown) {
                return errorResult((err as Error).message);
            }
        }
    );
}
