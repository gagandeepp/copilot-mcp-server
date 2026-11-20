import { completable } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { fetchBilling } from "../data/billing.js";
import { getToken } from "../github-client.js";
import { completeOrg } from "../org-completion.js";
import { billingRef } from "../resource-uris.js";
import { orgLogin } from "../schemas.js";
import { embedResource, userText } from "./embed.js";
export function registerBillingForecastPrompt(server) {
    server.registerPrompt("copilot_billing_forecast", {
        title: "Copilot billing forecast",
        description: "Explain this billing cycle's Copilot seat changes for one organization and forecast the seat count for the next cycle.",
        argsSchema: z.strictObject({
            org: completable(orgLogin.describe("GitHub organization login (slug), e.g. 'my-company'"), completeOrg),
        }),
    }, async ({ org }, ctx) => ({
        messages: [
            await embedResource(billingRef(org), `the get_copilot_billing_summary tool with org "${org}" and response_format "json"`, () => fetchBilling(org, getToken(), ctx.mcpReq.signal)),
            userText(`Forecast the GitHub Copilot seat count for the organization "${org}" for the next billing cycle from the billing summary above. Explain:\n` +
                `1. Seats added this cycle (seat_breakdown.added_this_cycle) and how they relate to the current total.\n` +
                `2. Pending invitations (pending_invitation): seats that appear only once the invitation is accepted.\n` +
                `3. Pending cancellations (pending_cancellation): seats that are removed at the end of the cycle.\n` +
                `4. The expected seat count next cycle. Start from total + pending_invitation - pending_cancellation, then say which assumptions could move it (for example invitations that are never accepted, or more seats added at the current pace) and give a low and a high case.\n` +
                `Show the arithmetic, name the plan_type and seat_management_setting that apply, and say plainly when a number is an assumption rather than data. If the block above is a note that the data could not be loaded, say so and do not guess.`),
        ],
    }));
}
//# sourceMappingURL=billing-forecast.js.map