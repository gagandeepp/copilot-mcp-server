import * as z from "zod/v4";

// Schemas for GitHub's Copilot usage-metrics report files, from
// https://docs.github.com/en/copilot/reference/copilot-usage-metrics/copilot-usage-metrics
// Every field is nullable or absent and a wrongly typed value is dropped, so new or changed fields never reject
// a whole report. The only structural requirements are a `day_totals` array (28-day report) or a `day` string (1-day report).
const num = z.number().nullish().catch(undefined);
const str = z.string().nullish().catch(undefined);
const list = <T extends z.ZodType>(item: T) => z.array(item).nullish().catch(undefined);

const activity = {
    user_initiated_interaction_count: num,
    code_generation_activity_count: num,
    code_acceptance_activity_count: num,
    loc_suggested_to_add_sum: num,
    loc_added_sum: num,
    loc_deleted_sum: num,
};
const ACTIVITY_KEYS = Object.keys(activity) as (keyof typeof activity)[];

const dayShape = {
    day: str,
    daily_active_users: num,
    weekly_active_users: num,
    monthly_active_users: num,
    monthly_active_chat_users: num,
    monthly_active_agent_users: num,
    ...activity,
    totals_by_ide: list(z.looseObject({ ide: str, ...activity })),
    totals_by_feature: list(z.looseObject({ feature: str, ...activity })),
    totals_by_language_feature: list(z.looseObject({ language: str, feature: str, ...activity })),
    totals_by_language_model: list(z.looseObject({ language: str, model: str, ...activity })),
    totals_by_model_feature: list(z.looseObject({ model: str, feature: str, ...activity })),
};

const dayEntry = z.looseObject(dayShape);

// The 28-day report: one wrapper record holding a daily record per day.
const wrapperRecord = z.looseObject({
    report_start_day: str,
    report_end_day: str,
    copilot_feature_engagement: z
        .looseObject({
            active_user_count: num,
            totals_by_feature: list(z.looseObject({ feature: str, engaged_user_count: num })),
        })
        .nullish()
        .catch(undefined),
    day_totals: z.array(dayEntry),
});

// The 1-day report: the daily record itself.
const dayRecord = z.looseObject({ ...dayShape, day: z.string() });

const reportRecord = z.union([wrapperRecord, dayRecord]);

/** The `download_links` envelope returned by the report endpoints. */
export const reportLinks = z.looseObject({
    download_links: z.array(z.string()),
    report_day: z.string().nullish(),
    report_start_day: z.string().nullish(),
    report_end_day: z.string().nullish(),
});

type DayEntry = z.infer<typeof dayEntry>;
type WrapperRecord = z.infer<typeof wrapperRecord>;
export type ReportRecord = z.infer<typeof reportRecord>;

/**
 * Parse a downloaded report file. Reports are newline-delimited JSON (one record per line), but a file that is
 * one JSON array or object (also what a one-line file is) is accepted too. Lines or records that are not valid
 * report records are counted in `malformed` and skipped.
 */
export function parseReportFile(text: string): { records: ReportRecord[]; malformed: number } {
    const trimmed = text.trim();
    let values: unknown[] = [];
    let malformed = 0;

    try {
        const whole: unknown = JSON.parse(trimmed);
        values = Array.isArray(whole) ? whole : [whole];
    } catch {
        // Not a single JSON document: NDJSON, one record per line.
        for (const line of trimmed.split(/\r?\n/)) {
            if (line.trim() === "") continue;
            try {
                values.push(JSON.parse(line));
            } catch {
                malformed++;
            }
        }
    }

    const records: ReportRecord[] = [];
    for (const value of values) {
        const parsed = reportRecord.safeParse(value);
        if (parsed.success) records.push(parsed.data);
        else malformed++;
    }
    return { records, malformed };
}

/** One row of activity counts; a count the report does not give is null (printed as a dash in Markdown, never as 0). */
export type Activity = { [K in keyof typeof activity]: number | null };

export interface BreakdownRow extends Activity {
    name: string;
}

export interface DailyRow extends Activity {
    day: string;
    daily_active_users: number | null;
}

/** The data behind the metrics summary, shared by the Markdown renderer and `response_format: "json"`. */
export interface MetricsSummary {
    org: string;
    available: true;
    /** First and last date the report covers (equal for a single day); null when the report has no dates. */
    period: { start: string | null; end: string | null };
    /** Number of daily records in the report. */
    day_count: number;
    /** Report lines or records that were not valid and were skipped. */
    malformed_lines: number;
    /** Distinct-user counts, taken from the latest day (they cannot be summed across days). */
    active_users: {
        as_of_day: string | null;
        daily: number | null;
        weekly: number | null;
        monthly: number | null;
        monthly_chat: number | null;
        monthly_agent: number | null;
        /** Peak and average of the daily counts; null unless the report covers more than one day. */
        peak_daily: number | null;
        average_daily: number | null;
    };
    /** Users active on at least 2 days of the window per feature (28-day report only; features overlap). */
    feature_engagement: { feature: string; engaged_user_count: number }[];
    /** Sum over the period. `all` is the sum of the daily totals; the other two come from the feature breakdown. */
    activity: { all: Activity; code_completions: Activity | null; chat: Activity | null };
    /** Complete breakdowns, sorted by prompts + generations (then lines added, then name), best first. */
    by_ide: BreakdownRow[];
    by_feature: BreakdownRow[];
    by_language: BreakdownRow[];
    by_model: BreakdownRow[];
    /** One row per dated day, oldest first. */
    daily: DailyRow[];
}

type Totals = Partial<Record<keyof typeof activity, number>>;

/** Add a row's activity counts into `into`; counts a row does not report stay unset so they stay null, not 0. */
function addActivity(into: Totals, row: Totals | { [K in keyof typeof activity]?: number | null }): void {
    for (const key of ACTIVITY_KEYS) {
        const value = row[key];
        if (typeof value === "number") into[key] = (into[key] ?? 0) + value;
    }
}

function toActivity(row: { [K in keyof typeof activity]?: number | null }): Activity {
    const out = {} as Activity;
    for (const key of ACTIVITY_KEYS) out[key] = row[key] ?? null;
    return out;
}

function groupBy<T extends { [K in keyof typeof activity]?: number | null }>(
    rows: T[],
    name: (row: T) => string | null | undefined
): Map<string, Totals> {
    const groups = new Map<string, Totals>();
    for (const row of rows) {
        const key = name(row) ?? "unknown";
        const totals = groups.get(key) ?? {};
        addActivity(totals, row);
        groups.set(key, totals);
    }
    return groups;
}

const rank = (t: Totals) => (t.code_generation_activity_count ?? 0) + (t.user_initiated_interaction_count ?? 0);

function rankedRows(groups: Map<string, Totals>): BreakdownRow[] {
    return [...groups]
        .sort(
            ([aName, a], [bName, b]) =>
                rank(b) - rank(a) || (b.loc_added_sum ?? 0) - (a.loc_added_sum ?? 0) || aName.localeCompare(bName)
        )
        .map(([name, totals]) => ({ name, ...toActivity(totals) }));
}

const isWrapper = (record: ReportRecord): record is WrapperRecord => Array.isArray(record.day_totals);

/** Aggregate parsed report records (a 28-day report or a single day) into the metrics summary data. */
export function buildMetricsSummary(org: string, records: ReportRecord[], malformed: number): MetricsSummary {
    const wrappers = records.filter(isWrapper);
    const days: DayEntry[] = records.flatMap((r) => (isWrapper(r) ? r.day_totals : [r]));
    const dated = days
        .filter((d): d is DayEntry & { day: string } => typeof d.day === "string")
        .sort((a, b) => a.day.localeCompare(b.day));

    const dates = [
        ...wrappers.flatMap((w) => [w.report_start_day, w.report_end_day]),
        ...dated.map((d) => d.day),
    ]
        .filter((d): d is string => typeof d === "string")
        .sort();

    // Distinct-user counts cannot be summed across days: take them from the latest day.
    const latest = dated.at(-1) ?? days.at(-1);
    const daily = days.map((d) => d.daily_active_users).filter((n): n is number => typeof n === "number");

    const engagement = wrappers.map((w) => w.copilot_feature_engagement).filter((e) => e != null).at(-1);
    const engaged = (engagement?.totals_by_feature ?? []).flatMap((f) =>
        typeof f.engaged_user_count === "number"
            ? [{ feature: f.feature ?? "unknown", engaged_user_count: f.engaged_user_count }]
            : []
    );

    // Headline activity is the sum of the daily totals; the feature rows come from the breakdowns, which can omit server-side-only users.
    const everything: Totals = {};
    const completions: Totals = {};
    const chat: Totals = {};
    for (const day of days) {
        addActivity(everything, day);
        for (const row of day.totals_by_feature ?? []) {
            if (row.feature === "code_completion") addActivity(completions, row);
            else if (row.feature?.startsWith("chat_")) addActivity(chat, row);
        }
    }

    // Both model breakdowns slice the same chat activity, so use one source and never add them together.
    const modelFeature = days.flatMap((d) => d.totals_by_model_feature ?? []);
    const modelRows = modelFeature.length > 0 ? modelFeature : days.flatMap((d) => d.totals_by_language_model ?? []);

    return {
        org,
        available: true,
        period: { start: dates[0] ?? null, end: dates.at(-1) ?? null },
        day_count: days.length,
        malformed_lines: malformed,
        active_users: {
            as_of_day: latest?.day || null,
            daily: latest?.daily_active_users ?? null,
            weekly: latest?.weekly_active_users ?? null,
            monthly: latest?.monthly_active_users ?? null,
            monthly_chat: latest?.monthly_active_chat_users ?? null,
            monthly_agent: latest?.monthly_active_agent_users ?? null,
            peak_daily: daily.length > 1 ? Math.max(...daily) : null,
            average_daily: daily.length > 1 ? Number((daily.reduce((a, b) => a + b, 0) / daily.length).toFixed(1)) : null,
        },
        feature_engagement: engaged,
        activity: {
            all: toActivity(everything),
            code_completions: Object.keys(completions).length > 0 ? toActivity(completions) : null,
            chat: Object.keys(chat).length > 0 ? toActivity(chat) : null,
        },
        by_ide: rankedRows(groupBy(days.flatMap((d) => d.totals_by_ide ?? []), (r) => r.ide)),
        by_feature: rankedRows(groupBy(days.flatMap((d) => d.totals_by_feature ?? []), (r) => r.feature)),
        by_language: rankedRows(groupBy(days.flatMap((d) => d.totals_by_language_feature ?? []), (r) => r.language)),
        by_model: rankedRows(groupBy(modelRows, (r) => r.model)),
        daily: dated.map((d) => ({ day: d.day, daily_active_users: d.daily_active_users ?? null, ...toActivity(d) })),
    };
}
