import { ApiError, downloadReport, githubFetch } from "../github-client.js";
import { cell } from "../markdown.js";
import { buildMetricsSummary, parseReportFile, reportLinks } from "../metrics-report.js";
import type { Activity, BreakdownRow, MetricsSummary, ReportRecord } from "../metrics-report.js";

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
export class EmptyReportError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "EmptyReportError";
    }
}

// The client's generic 403/404 text is about billing; the reports API has its own access rules.
export function metricsErrorMessage(err: unknown): string {
    if (!(err instanceof ApiError) || err.rateLimited) return (err as Error).message;
    const githubSays = err.message.match(/ GitHub says: .*$/s)?.[0] ?? "";
    if (err.status === 403) {
        return "Access denied (HTTP 403). Copilot usage metrics require an organization owner or the fine-grained " +
            "\"View Organization Copilot Metrics\" permission (classic tokens need read:org)." + githubSays;
    }
    if (err.status === 404) {
        return "Not found (HTTP 404). Check the org login with list_organizations, and that the organization's " +
            "\"Copilot usage metrics\" policy is enabled." + githubSays;
    }
    return err.message;
}

export async function fetchMetrics(
    org: string,
    day: string | undefined,
    token: string,
    signal?: AbortSignal
): Promise<MetricsData> {
    const unavailable = (message: string): MetricsUnavailable => ({
        org,
        ...(day ? { day } : {}),
        available: false,
        message,
    });

    const base = `/orgs/${encodeURIComponent(org)}/copilot/metrics/reports`;
    const path = day
        ? `${base}/organization-1-day?${new URLSearchParams({ day })}`
        : `${base}/organization-28-day/latest`;
    const response = await githubFetch<unknown>(path, token, signal);

    // 204 No Content: GitHub has no report to give.
    if (response === null) {
        return unavailable(
            day
                ? `No Copilot usage metrics report exists for ${day} in org "${org}". ` +
                  "Daily reports are available from 2025-10-10 and up to one year back, and a day's data can take up to two full UTC days after it ends to appear. " +
                  "Omit `day` to get the latest 28-day report."
                : `GitHub has no 28-day Copilot usage metrics report for org "${org}" yet. Try again later.`
        );
    }

    const links = reportLinks.safeParse(response);
    if (!links.success) {
        throw new Error("GitHub returned an unexpected response (no download_links). Try again later.");
    }
    if (links.data.download_links.length === 0) {
        return unavailable(`GitHub returned a Copilot usage metrics report for org "${org}" with no download links. Try again later.`);
    }

    const records: ReportRecord[] = [];
    let malformed = 0;
    for (const link of links.data.download_links) {
        const parsed = parseReportFile(await downloadReport(link, signal));
        records.push(...parsed.records);
        malformed += parsed.malformed;
    }

    if (records.length === 0) {
        throw new EmptyReportError(
            `The Copilot usage metrics report for org "${org}" had no usable records (${malformed} malformed line(s) skipped).`
        );
    }
    return buildMetricsSummary(org, records, malformed);
}

const TOP_N = 10;

const show = (value: number | null | undefined) => (typeof value === "number" ? String(value) : "—");
// Names come from the report: escape them for a table cell and keep them short.
const name = (value: string) => cell(value.slice(0, 80));

function activityRow(label: string, a: Activity): string {
    return (
        `| ${name(label)} | ${show(a.user_initiated_interaction_count)} | ${show(a.code_generation_activity_count)} ` +
        `| ${show(a.code_acceptance_activity_count)} | ${show(a.loc_suggested_to_add_sum)} | ${show(a.loc_added_sum)} |`
    );
}

function activityTable(nameHeader: string, rows: [string, Activity][]): string[] {
    return [
        `| ${nameHeader} | Prompts | Generations | Accepted | Lines suggested | Lines added |`,
        `|---|---|---|---|---|---|`,
        ...rows.map(([label, activity]) => activityRow(label, activity)),
    ];
}

function breakdown(title: string, nameHeader: string, rows: BreakdownRow[]): string[] {
    if (rows.length === 0) return [];
    const suffix = rows.length > TOP_N ? `, top ${TOP_N} of ${rows.length}` : "";
    return [
        "",
        `### ${title}${suffix}`,
        ...activityTable(nameHeader, rows.slice(0, TOP_N).map((row): [string, Activity] => [row.name, row])),
    ];
}

/** Render the metrics data as compact Markdown. */
export function renderMetricsMarkdown(data: MetricsData): string {
    if (!data.available) return data.message;

    const { start, end } = data.period;
    const period = start === null ? "" : start === end ? `Day: ${start}` : `Period: ${start} to ${end}`;

    const lines = [`## Copilot Usage Metrics for **${data.org}**`, `_${[period, `${data.day_count} day(s) of data`].filter(Boolean).join(" · ")}_`];
    if (data.malformed_lines > 0) lines.push(`_Skipped ${data.malformed_lines} malformed line(s) in the report._`);
    if (data.day_count === 0) return [...lines, "", "The report contains no daily records."].join("\n");

    const u = data.active_users;
    const users: [string, number | null][] = [
        [u.as_of_day ? `Daily active (${u.as_of_day})` : "Daily active", u.daily],
        ["Weekly active (trailing 7 days)", u.weekly],
        ["Monthly active (trailing 28 days)", u.monthly],
        ["Monthly chat users (28 days)", u.monthly_chat],
        ["Monthly agent mode users (28 days)", u.monthly_agent],
        ["Peak daily active", u.peak_daily],
        ["Average daily active", u.average_daily],
    ];
    lines.push("", "### Active Users", "| Metric | Users |", "|---|---|");
    for (const [label, value] of users) {
        if (typeof value === "number") lines.push(`| ${label} | ${value} |`);
    }

    if (data.feature_engagement.length > 0) {
        lines.push(
            "",
            `**Feature engagement** (users active on at least 2 days of the window; features overlap, so do not add them): ` +
                data.feature_engagement.map((f) => `${name(f.feature)} ${f.engaged_user_count}`).join(", ")
        );
    }

    const activityRows: [string, Activity][] = [["All activity", data.activity.all]];
    if (data.activity.code_completions) activityRows.push(["Code completions", data.activity.code_completions]);
    if (data.activity.chat) activityRows.push(["Chat", data.activity.chat]);
    lines.push("", "### Activity (sum over the period)", ...activityTable("Scope", activityRows));

    lines.push(...breakdown("By IDE", "IDE", data.by_ide));
    lines.push(...breakdown("By feature", "Feature", data.by_feature));
    lines.push(...breakdown("By language", "Language", data.by_language));
    lines.push(...breakdown("By model (chat only)", "Model", data.by_model));

    if (data.daily.length > 1) {
        lines.push("", "### Daily", "| Day | Active users | Prompts | Generations | Accepted | Lines added |", "|---|---|---|---|---|---|");
        for (const d of data.daily) {
            lines.push(
                `| ${d.day} | ${show(d.daily_active_users)} | ${show(d.user_initiated_interaction_count)} ` +
                    `| ${show(d.code_generation_activity_count)} | ${show(d.code_acceptance_activity_count)} | ${show(d.loc_added_sum)} |`
            );
        }
    }

    return lines.join("\n");
}
