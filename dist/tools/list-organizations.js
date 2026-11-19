import { getToken, githubFetchAll } from "../github-client.js";
export function registerListOrganizations(server) {
    server.registerTool("list_organizations", {
        description: "List all GitHub organizations the authenticated user belongs to, with their IDs. Use the org login (slug) for subsequent Copilot queries.",
    }, async () => {
        try {
            const token = getToken();
            const orgs = await githubFetchAll("/user/orgs?per_page=100", token);
            if (orgs.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
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
                        type: "text",
                        text: `Found ${orgs.length} organization(s):\n\n` +
                            `| ID | Login (use this as org) | Description |\n` +
                            `|----|------------------------|-------------|\n` +
                            table
                                .map((r) => `| ${r.id} | ${r.login} | ${r.description} |`)
                                .join("\n"),
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
//# sourceMappingURL=list-organizations.js.map