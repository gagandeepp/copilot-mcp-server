import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { fetchUsageAllOrgs, renderUsageMarkdown } from "../data/usage.js";
import { getToken } from "../github-client.js";
import { responseFormat } from "../schemas.js";
import { errorResult, formatResult } from "./result.js";

export function registerGetCopilotUsageAllOrgs(server: McpServer): void {
    server.registerTool(
        "get_copilot_usage_all_orgs",
        {
            title: "Copilot Usage Across All Orgs",
            description: "Get a high-level Copilot usage summary across ALL organizations the authenticated user belongs to. Shows seat counts and active users per org in a single view.",
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
                const progressToken = ctx.mcpReq._meta?.progressToken;
                const data = await fetchUsageAllOrgs(
                    getToken(),
                    ctx.mcpReq.signal,
                    progressToken === undefined
                        ? undefined
                        : (progress, total, login) =>
                              // Progress is best-effort: a failed notification must not fail the tool call.
                              ctx.mcpReq
                                  .notify({
                                      method: "notifications/progress",
                                      params: { progressToken, progress, total, message: login },
                                  })
                                  .catch(() => {})
                );
                return formatResult(data, response_format, renderUsageMarkdown);
            } catch (err: unknown) {
                return errorResult((err as Error).message);
            }
        }
    );
}
