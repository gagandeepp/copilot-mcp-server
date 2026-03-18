import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getToken, githubFetchAll } from "../github-client.js";
import type { GitHubOrg } from "../types.js";

export function registerListOrganizations(server: McpServer): void {
    server.registerTool(
        "list_organizations",
        {
            description: "List all GitHub organizations the authenticated user belongs to, with their IDs. Use the org login (slug) for subsequent Copilot queries.",
            inputSchema: {},
        },
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
}
