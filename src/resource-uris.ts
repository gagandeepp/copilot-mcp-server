// The resource URIs and display names, shared by the resources, the resource_link blocks the tools return and the
// resources the prompts embed. Org logins are validated by `orgLogin` before they get here (letters, digits, "-" and "_"),
// so they need no URI encoding.

export const JSON_MIME = "application/json";

export const ORGS_URI = "copilot://orgs";
export const BILLING_TEMPLATE = "copilot://orgs/{org}/billing";
export const METRICS_28_DAY_TEMPLATE = "copilot://orgs/{org}/metrics/28-day";
export const METRICS_DAILY_TEMPLATE = "copilot://orgs/{org}/metrics/daily/{day}";

export interface ResourceRef {
    uri: string;
    name: string;
}

export const organizationsRef = (): ResourceRef => ({ uri: ORGS_URI, name: "Copilot organizations" });

export const billingRef = (org: string): ResourceRef => ({
    uri: `copilot://orgs/${org}/billing`,
    name: `Copilot billing: ${org}`,
});

export const metrics28DayRef = (org: string): ResourceRef => ({
    uri: `copilot://orgs/${org}/metrics/28-day`,
    name: `Copilot 28-day metrics: ${org}`,
});

export const metricsDailyRef = (org: string, day: string): ResourceRef => ({
    uri: `copilot://orgs/${org}/metrics/daily/${day}`,
    name: `Copilot metrics for ${day}: ${org}`,
});
