#!/usr/bin/env node
import "dotenv/config";
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { registerListOrganizations } from "./tools/list-organizations.js";
import { registerGetCopilotBillingSummary } from "./tools/get-copilot-billing-summary.js";
import { registerGetCopilotSeats } from "./tools/get-copilot-seats.js";
import { registerGetCopilotMetrics } from "./tools/get-copilot-metrics.js";
import { registerGetCopilotUsageAllOrgs } from "./tools/get-copilot-usage-all-orgs.js";
// package.json sits one level above both src/ and dist/, so this resolves to the package root in either layout.
const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
function createServer() {
    const server = new McpServer({
        name: "github-copilot-usage",
        title: "GitHub Copilot Usage",
        description: "Read-only GitHub Copilot billing, seat and usage data across your GitHub organizations.",
        version,
    }, {
        instructions: "Read-only access to GitHub Copilot billing, seat and usage data for the organizations visible to GITHUB_TOKEN. Call list_organizations first to get org logins, then pass a login as `org` to the other tools. Copilot billing and seat data require the token's user to be an organization owner (classic PAT scopes manage_billing:copilot or read:org). Use get_copilot_usage_all_orgs for a cross-org overview and get_copilot_seats for per-user activity.",
        // The tool list is static and the same for every caller, so shared caches may keep it for an hour.
        cacheHints: {
            "tools/list": { ttlMs: 3_600_000, cacheScope: "public" },
        },
    });
    registerListOrganizations(server);
    registerGetCopilotBillingSummary(server);
    registerGetCopilotSeats(server);
    registerGetCopilotMetrics(server);
    registerGetCopilotUsageAllOrgs(server);
    return server;
}
serveStdio(createServer);
console.error("GitHub Copilot Usage MCP server running on stdio");
//# sourceMappingURL=index.js.map