#!/usr/bin/env node
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { registerListOrganizations } from "./tools/list-organizations.js";
import { registerGetCopilotBillingSummary } from "./tools/get-copilot-billing-summary.js";
import { registerGetCopilotSeats } from "./tools/get-copilot-seats.js";
import { registerGetCopilotMetrics } from "./tools/get-copilot-metrics.js";
import { registerGetCopilotUsageAllOrgs } from "./tools/get-copilot-usage-all-orgs.js";
import { registerBillingResource } from "./resources/billing.js";
import { registerMetrics28DayResource } from "./resources/metrics-28-day.js";
import { registerMetricsDailyResource } from "./resources/metrics-daily.js";
import { registerOrganizationsResource } from "./resources/organizations.js";
import { registerAdoptionReportPrompt } from "./prompts/adoption-report.js";
import { registerBillingForecastPrompt } from "./prompts/billing-forecast.js";
import { registerInactiveSeatsReviewPrompt } from "./prompts/inactive-seats-review.js";
import { registerOrgComparisonPrompt } from "./prompts/org-comparison.js";
import { version } from "./version.js";
function createServer() {
    const server = new McpServer({
        name: "github-copilot-usage",
        title: "GitHub Copilot Usage",
        description: "Read-only GitHub Copilot billing, seat and usage data across your GitHub organizations.",
        version,
    }, {
        instructions: "Read-only access to GitHub Copilot billing, seat and usage data for the organizations visible to GITHUB_TOKEN. Call list_organizations first to get org logins, then pass a login as `org` to the other tools. Copilot billing and seat data require the token's user to be an organization owner (classic PAT scopes manage_billing:copilot or read:org). Use get_copilot_usage_all_orgs for a cross-org overview and get_copilot_seats for per-user activity. The org, billing and metrics data is also readable as resources (copilot://orgs, copilot://orgs/{org}/billing, copilot://orgs/{org}/metrics/28-day and copilot://orgs/{org}/metrics/daily/{day}), and the prompts copilot_inactive_seats_review, copilot_adoption_report, copilot_org_comparison and copilot_billing_forecast package common reviews.",
        cacheHints: {
            // The tool, prompt and template lists are static and the same for every caller, so shared caches may keep them for an hour.
            "tools/list": { ttlMs: 3_600_000, cacheScope: "public" },
            "prompts/list": { ttlMs: 3_600_000, cacheScope: "public" },
            "resources/templates/list": { ttlMs: 3_600_000, cacheScope: "public" },
            // The resource list has one entry per org the token can see, so only the requesting client may cache it, and briefly.
            "resources/list": { ttlMs: 300_000, cacheScope: "private" },
        },
    });
    registerListOrganizations(server);
    registerGetCopilotBillingSummary(server);
    registerGetCopilotSeats(server);
    registerGetCopilotMetrics(server);
    registerGetCopilotUsageAllOrgs(server);
    registerOrganizationsResource(server);
    registerBillingResource(server);
    registerMetrics28DayResource(server);
    registerMetricsDailyResource(server);
    registerInactiveSeatsReviewPrompt(server);
    registerAdoptionReportPrompt(server);
    registerOrgComparisonPrompt(server);
    registerBillingForecastPrompt(server);
    return server;
}
serveStdio(createServer);
console.error("GitHub Copilot Usage MCP server running on stdio");
//# sourceMappingURL=index.js.map