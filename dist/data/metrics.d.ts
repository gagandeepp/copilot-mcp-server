import type { MetricsSummary } from "../metrics-report.js";
/** GitHub has no report to give (204) or the envelope has no download links: not an error, but there is no data. */
export interface MetricsUnavailable {
    org: string;
    /** Present only when a single day was requested. */
    day?: string;
    available: false;
    message: string;
}
export type MetricsData = MetricsSummary | MetricsUnavailable;
/** The report downloaded but held nothing usable. An error, but its message already says everything, so it is shown without the usual "Error: " prefix. */
export declare class EmptyReportError extends Error {
    constructor(message: string);
}
export declare function metricsErrorMessage(err: unknown): string;
export declare function fetchMetrics(org: string, day: string | undefined, token: string, signal?: AbortSignal): Promise<MetricsData>;
/** Render the metrics data as compact Markdown. */
export declare function renderMetricsMarkdown(data: MetricsData): string;
//# sourceMappingURL=metrics.d.ts.map