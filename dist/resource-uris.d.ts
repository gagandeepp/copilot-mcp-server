export declare const JSON_MIME = "application/json";
export declare const ORGS_URI = "copilot://orgs";
export declare const BILLING_TEMPLATE = "copilot://orgs/{org}/billing";
export declare const METRICS_28_DAY_TEMPLATE = "copilot://orgs/{org}/metrics/28-day";
export declare const METRICS_DAILY_TEMPLATE = "copilot://orgs/{org}/metrics/daily/{day}";
export interface ResourceRef {
    uri: string;
    name: string;
}
export declare const organizationsRef: () => ResourceRef;
export declare const billingRef: (org: string) => ResourceRef;
export declare const metrics28DayRef: (org: string) => ResourceRef;
export declare const metricsDailyRef: (org: string, day: string) => ResourceRef;
//# sourceMappingURL=resource-uris.d.ts.map