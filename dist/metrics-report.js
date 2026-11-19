import * as z from "zod/v4";
// Schemas for GitHub's Copilot usage-metrics report files, from
// https://docs.github.com/en/copilot/reference/copilot-usage-metrics/copilot-usage-metrics
// Every field is nullable or absent and a wrongly typed value is dropped, so new or changed fields never reject
// a whole report. The only structural requirements are a `day_totals` array (28-day report) or a `day` string (1-day report).
const num = z.number().nullish().catch(undefined);
const str = z.string().nullish().catch(undefined);
const list = (item) => z.array(item).nullish().catch(undefined);
const activity = {
    user_initiated_interaction_count: num,
    code_generation_activity_count: num,
    code_acceptance_activity_count: num,
    loc_suggested_to_add_sum: num,
    loc_added_sum: num,
    loc_deleted_sum: num,
};
const ACTIVITY_KEYS = Object.keys(activity);
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
/**
 * Parse a downloaded report file. Reports are newline-delimited JSON (one record per line), but a file that is
 * one JSON array or object (also what a one-line file is) is accepted too. Lines or records that are not valid
 * report records are counted in `malformed` and skipped.
 */
export function parseReportFile(text) {
    const trimmed = text.trim();
    let values = [];
    let malformed = 0;
    try {
        const whole = JSON.parse(trimmed);
        values = Array.isArray(whole) ? whole : [whole];
    }
    catch {
        // Not a single JSON document: NDJSON, one record per line.
        for (const line of trimmed.split(/\r?\n/)) {
            if (line.trim() === "")
                continue;
            try {
                values.push(JSON.parse(line));
            }
            catch {
                malformed++;
            }
        }
    }
    const records = [];
    for (const value of values) {
        const parsed = reportRecord.safeParse(value);
        if (parsed.success)
            records.push(parsed.data);
        else
            malformed++;
    }
    return { records, malformed };
}
const TOP_N = 10;
/** Add a row's activity counts into `into`; counts a row does not report stay unset so they print as a dash, not 0. */
function addActivity(into, row) {
    for (const key of ACTIVITY_KEYS) {
        const value = row[key];
        if (typeof value === "number")
            into[key] = (into[key] ?? 0) + value;
    }
}
function groupBy(rows, name) {
    const groups = new Map();
    for (const row of rows) {
        const key = name(row) ?? "unknown";
        const totals = groups.get(key) ?? {};
        addActivity(totals, row);
        groups.set(key, totals);
    }
    return groups;
}
const cell = (value) => value.replace(/[|\r\n]+/g, " ").slice(0, 80);
const show = (value) => (typeof value === "number" ? String(value) : "—");
const rank = (t) => (t.code_generation_activity_count ?? 0) + (t.user_initiated_interaction_count ?? 0);
function activityRow(name, t) {
    return (`| ${cell(name)} | ${show(t.user_initiated_interaction_count)} | ${show(t.code_generation_activity_count)} ` +
        `| ${show(t.code_acceptance_activity_count)} | ${show(t.loc_suggested_to_add_sum)} | ${show(t.loc_added_sum)} |`);
}
function activityTable(nameHeader, rows) {
    return [
        `| ${nameHeader} | Prompts | Generations | Accepted | Lines suggested | Lines added |`,
        `|---|---|---|---|---|---|`,
        ...rows.map(([name, totals]) => activityRow(name, totals)),
    ];
}
function breakdown(title, nameHeader, groups) {
    if (groups.size === 0)
        return [];
    const rows = [...groups].sort(([aName, a], [bName, b]) => rank(b) - rank(a) || (b.loc_added_sum ?? 0) - (a.loc_added_sum ?? 0) || aName.localeCompare(bName));
    const suffix = rows.length > TOP_N ? `, top ${TOP_N} of ${rows.length}` : "";
    return ["", `### ${title}${suffix}`, ...activityTable(nameHeader, rows.slice(0, TOP_N))];
}
const isWrapper = (record) => Array.isArray(record.day_totals);
/** Summarise parsed report records (a 28-day report or a single day) as compact Markdown. */
export function summarizeReports(org, records, malformed) {
    const wrappers = records.filter(isWrapper);
    const days = records.flatMap((r) => (isWrapper(r) ? r.day_totals : [r]));
    const dated = days
        .filter((d) => typeof d.day === "string")
        .sort((a, b) => a.day.localeCompare(b.day));
    const dates = [
        ...wrappers.flatMap((w) => [w.report_start_day, w.report_end_day]),
        ...dated.map((d) => d.day),
    ]
        .filter((d) => typeof d === "string")
        .sort();
    const first = dates[0];
    const last = dates.at(-1);
    const period = first === undefined ? "" : first === last ? `Day: ${first}` : `Period: ${first} to ${last}`;
    const lines = [`## Copilot Usage Metrics for **${org}**`, `_${[period, `${days.length} day(s) of data`].filter(Boolean).join(" · ")}_`];
    if (malformed > 0)
        lines.push(`_Skipped ${malformed} malformed line(s) in the report._`);
    if (days.length === 0)
        return [...lines, "", "The report contains no daily records."].join("\n");
    // Distinct-user counts cannot be summed across days: take them from the latest day.
    const latest = dated.at(-1) ?? days[days.length - 1];
    const users = [
        [latest.day ? `Daily active (${latest.day})` : "Daily active", latest.daily_active_users],
        ["Weekly active (trailing 7 days)", latest.weekly_active_users],
        ["Monthly active (trailing 28 days)", latest.monthly_active_users],
        ["Monthly chat users (28 days)", latest.monthly_active_chat_users],
        ["Monthly agent mode users (28 days)", latest.monthly_active_agent_users],
    ];
    const daily = days.map((d) => d.daily_active_users).filter((n) => typeof n === "number");
    if (daily.length > 1) {
        users.push(["Peak daily active", Math.max(...daily)]);
        users.push(["Average daily active", Number((daily.reduce((a, b) => a + b, 0) / daily.length).toFixed(1))]);
    }
    lines.push("", "### Active Users", "| Metric | Users |", "|---|---|");
    for (const [label, value] of users) {
        if (typeof value === "number")
            lines.push(`| ${label} | ${value} |`);
    }
    const engagement = wrappers.map((w) => w.copilot_feature_engagement).filter((e) => e != null).at(-1);
    const engaged = (engagement?.totals_by_feature ?? []).filter((f) => typeof f.engaged_user_count === "number");
    if (engaged.length > 0) {
        lines.push("", `**Feature engagement** (users active on at least 2 days of the window; features overlap, so do not add them): ` +
            engaged.map((f) => `${cell(f.feature ?? "unknown")} ${f.engaged_user_count}`).join(", "));
    }
    // Headline activity is the sum of the daily totals; the feature rows come from the breakdowns, which can omit server-side-only users.
    const everything = {};
    const completions = {};
    const chat = {};
    for (const day of days) {
        addActivity(everything, day);
        for (const row of day.totals_by_feature ?? []) {
            if (row.feature === "code_completion")
                addActivity(completions, row);
            else if (row.feature?.startsWith("chat_"))
                addActivity(chat, row);
        }
    }
    const activityRows = [["All activity", everything]];
    if (Object.keys(completions).length > 0)
        activityRows.push(["Code completions", completions]);
    if (Object.keys(chat).length > 0)
        activityRows.push(["Chat", chat]);
    lines.push("", "### Activity (sum over the period)", ...activityTable("Scope", activityRows));
    lines.push(...breakdown("By IDE", "IDE", groupBy(days.flatMap((d) => d.totals_by_ide ?? []), (r) => r.ide)));
    lines.push(...breakdown("By feature", "Feature", groupBy(days.flatMap((d) => d.totals_by_feature ?? []), (r) => r.feature)));
    lines.push(...breakdown("By language", "Language", groupBy(days.flatMap((d) => d.totals_by_language_feature ?? []), (r) => r.language)));
    // Both model breakdowns slice the same chat activity, so use one source and never add them together.
    const modelFeature = days.flatMap((d) => d.totals_by_model_feature ?? []);
    const modelRows = modelFeature.length > 0 ? modelFeature : days.flatMap((d) => d.totals_by_language_model ?? []);
    lines.push(...breakdown("By model (chat only)", "Model", groupBy(modelRows, (r) => r.model)));
    if (dated.length > 1) {
        lines.push("", "### Daily", "| Day | Active users | Prompts | Generations | Accepted | Lines added |", "|---|---|---|---|---|---|");
        for (const d of dated) {
            lines.push(`| ${d.day} | ${show(d.daily_active_users)} | ${show(d.user_initiated_interaction_count)} ` +
                `| ${show(d.code_generation_activity_count)} | ${show(d.code_acceptance_activity_count)} | ${show(d.loc_added_sum)} |`);
        }
    }
    return lines.join("\n");
}
//# sourceMappingURL=metrics-report.js.map