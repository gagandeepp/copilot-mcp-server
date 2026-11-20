import { completable } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { completeOrg } from "../org-completion.js";
import { orgLogin } from "../schemas.js";
import { userText } from "./embed.js";
const DAY_MS = 86_400_000;
export function registerInactiveSeatsReviewPrompt(server) {
    server.registerPrompt("copilot_inactive_seats_review", {
        title: "Copilot inactive seats review",
        description: "Find the Copilot seats of one organization that have been inactive for N days, group them by team, estimate the monthly savings and list removal candidates.",
        argsSchema: z.strictObject({
            org: completable(orgLogin.describe("GitHub organization login (slug), e.g. 'my-company'"), completeOrg),
            inactive_days: z
                .string()
                .regex(/^\d{1,4}$/, "Use a whole number of days, for example 30")
                .default("30")
                .describe("A seat is inactive when its last activity is older than this many days (default 30)"),
        }),
    }, ({ org, inactive_days }) => {
        // The model may not know today's date, so give it the date and the cutoff it needs.
        const now = Date.now();
        const today = new Date(now).toISOString().slice(0, 10);
        const cutoff = new Date(now - Number(inactive_days) * DAY_MS).toISOString().slice(0, 10);
        return {
            messages: [
                userText(`Review the GitHub Copilot seats of the organization "${org}" and find the ones to remove.\n` +
                    `1. Call the get_copilot_seats tool with org "${org}", response_format "json" and per_page 100. Keep calling it with the next page (next_page) until has_more is false, so that no seat is missed.\n` +
                    `2. Today is ${today} (UTC). A seat is inactive when last_activity_at is null (never used) or older than ${inactive_days} days, which means before ${cutoff}. List those seats, and separately list every seat with a pending_cancellation_date.\n` +
                    `3. Group the inactive seats by team (a null team is "No team") and show how many seats each team has in total and how many are inactive.\n` +
                    `4. Estimate the monthly savings if the inactive seats are removed. For each plan_type that appears, state the per-seat monthly list price you assume (these prices are not in the data, so say they are assumptions to verify), then show the arithmetic per plan and in total. Exclude seats that already have a pending cancellation from the savings, since they are already leaving.\n` +
                    `5. Finish with a removal-candidate table with the columns user, team, plan_type, last_activity_at, last_activity_editor and days inactive, sorted by longest inactive first (never-used seats first).\n` +
                    `Only use data from the tool results. If a call fails, report the error instead of guessing.`),
            ],
        };
    });
}
//# sourceMappingURL=inactive-seats-review.js.map