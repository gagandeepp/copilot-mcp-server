import * as z from "zod/v4";
import { userText } from "./embed.js";
export function registerOrgComparisonPrompt(server) {
    server.registerPrompt("copilot_org_comparison", {
        title: "Copilot organization comparison",
        description: "Rank all your organizations by Copilot seat utilization and flag the ones below a threshold.",
        argsSchema: z.strictObject({
            min_active_pct: z
                .string()
                .regex(/^\d{1,3}$/, "Use a whole number from 0 to 100, for example 50")
                .refine((value) => Number(value) <= 100, "Use a whole number from 0 to 100, for example 50")
                .default("50")
                .describe("Organizations whose active seats are below this percentage of their total seats are flagged (default 50)"),
        }),
    }, ({ min_active_pct }) => ({
        messages: [
            userText(`Compare GitHub Copilot usage across all my organizations.\n` +
                `1. Call the get_copilot_usage_all_orgs tool with response_format "json".\n` +
                `2. For every organization with status "ok", compute utilization as seat_breakdown.active_this_cycle divided by seat_breakdown.total (as a percentage; treat 0 total seats as "no seats"). Rank the organizations from highest to lowest utilization in a table with total, active, inactive, pending cancellation, pending invitation and utilization.\n` +
                `3. Flag the organizations whose utilization is below ${min_active_pct}%, and say how many seats are idle in each.\n` +
                `4. List the organizations with status "skipped" (no Copilot subscription or no access) and "failed" (real errors such as rate limits), each with its reason, in a separate section. Do not include them in the ranking.\n` +
                `5. If "incomplete" is true, state clearly that the totals do not cover the failed organizations, and suggest retrying.\n` +
                `End with a one-line total (seats, active, inactive and overall utilization) and the single organization that deserves attention first.`),
        ],
    }));
}
//# sourceMappingURL=org-comparison.js.map