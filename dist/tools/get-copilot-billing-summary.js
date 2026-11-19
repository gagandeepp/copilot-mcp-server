import * as z from "zod/v4";
import { fetchBilling, renderBillingMarkdown } from "../data/billing.js";
import { getToken } from "../github-client.js";
import { orgLogin, responseFormat } from "../schemas.js";
import { errorResult, formatResult } from "./result.js";
export function registerGetCopilotBillingSummary(server) {
    server.registerTool("get_copilot_billing_summary", {
        title: "Copilot Billing Summary",
        description: "Get the Copilot billing summary for an organization, including total seats, active/inactive breakdown, plan type, and feature enablement status.",
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
        },
        inputSchema: z.strictObject({
            org: orgLogin.describe("GitHub organization login (slug), e.g. 'my-company'"),
            response_format: responseFormat,
        }),
    }, async ({ org, response_format }, ctx) => {
        try {
            const data = await fetchBilling(org, getToken(), ctx.mcpReq.signal);
            return formatResult(data, response_format, renderBillingMarkdown);
        }
        catch (err) {
            return errorResult(err.message);
        }
    });
}
//# sourceMappingURL=get-copilot-billing-summary.js.map