import { completable } from "@modelcontextprotocol/server";
import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { fetchBilling } from "../data/billing.js";
import { fetchMetrics, metricsErrorMessage } from "../data/metrics.js";
import { getToken } from "../github-client.js";
import { completeOrg } from "../org-completion.js";
import { billingRef, metrics28DayRef } from "../resource-uris.js";
import { orgLogin } from "../schemas.js";
import { embedResource, userText } from "./embed.js";

export function registerAdoptionReportPrompt(server: McpServer): void {
    server.registerPrompt(
        "copilot_adoption_report",
        {
            title: "Copilot adoption report",
            description: "Write an adoption report for one organization from its Copilot billing summary and latest 28-day usage metrics, with three concrete recommendations.",
            argsSchema: z.strictObject({
                org: completable(orgLogin.describe("GitHub organization login (slug), e.g. 'my-company'"), completeOrg),
            }),
        },
        async ({ org }, ctx) => {
            const signal = ctx.mcpReq.signal;
            return {
                messages: [
                    await embedResource(
                        billingRef(org),
                        `the get_copilot_billing_summary tool with org "${org}" and response_format "json"`,
                        () => fetchBilling(org, getToken(), signal)
                    ),
                    await embedResource(
                        metrics28DayRef(org),
                        `the get_copilot_metrics tool with org "${org}" and response_format "json"`,
                        () => fetchMetrics(org, undefined, getToken(), signal),
                        metricsErrorMessage
                    ),
                    userText(
                        `Write a GitHub Copilot adoption report for the organization "${org}" from the billing summary and the 28-day usage metrics above. Cover:\n` +
                            `1. Adoption rate: seat_breakdown.active_this_cycle divided by seat_breakdown.total, with both numbers. Say how many seats are inactive.\n` +
                            `2. Engaged and active users: the daily, weekly and monthly active users, the chat and agent-mode users, and feature_engagement, from active_users. Relate them to the seat count.\n` +
                            `3. Completions versus chat: compare activity.code_completions with activity.chat (prompts, generations, acceptances, lines added). Report the completion acceptance rate (code_acceptance_activity_count divided by code_generation_activity_count) when the counts allow it.\n` +
                            `4. The top IDEs, languages and models (by_ide, by_language, by_model).\n` +
                            `5. Exactly three concrete, prioritised recommendations to raise adoption or reduce waste, each tied to a number from the data.\n` +
                            `Use only numbers from the data; if a figure is null or missing, say so instead of estimating. If the metrics report says available is false, or a block above is a note that its data could not be loaded, say which parts of the report are missing and why.`
                    ),
                ],
            };
        }
    );
}
