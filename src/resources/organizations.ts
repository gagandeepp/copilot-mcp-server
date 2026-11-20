import type { McpServer } from "@modelcontextprotocol/server";
import { fetchOrganizations } from "../data/organizations.js";
import { getToken } from "../github-client.js";
import { JSON_MIME, ORGS_URI } from "../resource-uris.js";
import { jsonContents, resourceError } from "./read.js";

export function registerOrganizationsResource(server: McpServer): void {
    server.registerResource(
        "copilot_organizations",
        ORGS_URI,
        {
            title: "Copilot organizations",
            description: "The GitHub organizations GITHUB_TOKEN can see, with their logins: the same data as the list_organizations tool in JSON mode.",
            mimeType: JSON_MIME,
            // Org membership rarely changes, but it does depend on the token, so only the requesting client may cache it.
            cacheHint: { ttlMs: 3_600_000, cacheScope: "private" },
        },
        async (uri, ctx) => {
            try {
                return jsonContents(uri, await fetchOrganizations(getToken(), ctx.mcpReq.signal));
            } catch (err: unknown) {
                throw resourceError(err, uri);
            }
        }
    );
}
