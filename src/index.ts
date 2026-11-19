#!/usr/bin/env node

import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { registerListOrganizations } from "./tools/list-organizations.js";
import { registerGetCopilotBillingSummary } from "./tools/get-copilot-billing-summary.js";
import { registerGetCopilotSeats } from "./tools/get-copilot-seats.js";
import { registerGetCopilotMetrics } from "./tools/get-copilot-metrics.js";
import { registerGetCopilotUsageAllOrgs } from "./tools/get-copilot-usage-all-orgs.js";

function createServer(): McpServer {
    const server = new McpServer(
        {
            name: "github-copilot-usage",
            version: "2.0.0",
        },
        {
            // The tool list is static and the same for every caller, so shared caches may keep it for an hour.
            cacheHints: {
                "tools/list": { ttlMs: 3_600_000, cacheScope: "public" },
            },
        }
    );

    registerListOrganizations(server);
    registerGetCopilotBillingSummary(server);
    registerGetCopilotSeats(server);
    registerGetCopilotMetrics(server);
    registerGetCopilotUsageAllOrgs(server);

    return server;
}

serveStdio(createServer);
console.error("GitHub Copilot Usage MCP server running on stdio");
