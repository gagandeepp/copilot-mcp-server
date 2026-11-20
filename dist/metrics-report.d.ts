import * as z from "zod/v4";
declare const activity: {
    user_initiated_interaction_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    code_generation_activity_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    code_acceptance_activity_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    loc_suggested_to_add_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    loc_added_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    loc_deleted_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
};
declare const reportRecord: z.ZodUnion<readonly [z.ZodObject<{
    report_start_day: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    report_end_day: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    copilot_feature_engagement: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodObject<{
        active_user_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        totals_by_feature: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            feature: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            engaged_user_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        }, z.core.$loose>>>>>;
    }, z.core.$loose>>>>;
    day_totals: z.ZodArray<z.ZodObject<{
        totals_by_ide: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            user_initiated_interaction_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            code_generation_activity_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            code_acceptance_activity_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            loc_suggested_to_add_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            loc_added_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            loc_deleted_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            ide: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        }, z.core.$loose>>>>>;
        totals_by_feature: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            user_initiated_interaction_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            code_generation_activity_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            code_acceptance_activity_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            loc_suggested_to_add_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            loc_added_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            loc_deleted_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            feature: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        }, z.core.$loose>>>>>;
        totals_by_language_feature: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            user_initiated_interaction_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            code_generation_activity_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            code_acceptance_activity_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            loc_suggested_to_add_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            loc_added_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            loc_deleted_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            language: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            feature: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        }, z.core.$loose>>>>>;
        totals_by_language_model: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            user_initiated_interaction_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            code_generation_activity_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            code_acceptance_activity_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            loc_suggested_to_add_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            loc_added_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            loc_deleted_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            language: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            model: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        }, z.core.$loose>>>>>;
        totals_by_model_feature: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            user_initiated_interaction_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            code_generation_activity_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            code_acceptance_activity_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            loc_suggested_to_add_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            loc_added_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            loc_deleted_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            model: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            feature: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        }, z.core.$loose>>>>>;
        user_initiated_interaction_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        code_generation_activity_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        code_acceptance_activity_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        loc_suggested_to_add_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        loc_added_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        loc_deleted_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        day: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        daily_active_users: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        weekly_active_users: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        monthly_active_users: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        monthly_active_chat_users: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        monthly_active_agent_users: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    }, z.core.$loose>>;
}, z.core.$loose>, z.ZodObject<{
    day: z.ZodString;
    totals_by_ide: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        user_initiated_interaction_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        code_generation_activity_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        code_acceptance_activity_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        loc_suggested_to_add_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        loc_added_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        loc_deleted_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        ide: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    }, z.core.$loose>>>>>;
    totals_by_feature: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        user_initiated_interaction_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        code_generation_activity_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        code_acceptance_activity_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        loc_suggested_to_add_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        loc_added_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        loc_deleted_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        feature: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    }, z.core.$loose>>>>>;
    totals_by_language_feature: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        user_initiated_interaction_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        code_generation_activity_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        code_acceptance_activity_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        loc_suggested_to_add_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        loc_added_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        loc_deleted_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        language: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        feature: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    }, z.core.$loose>>>>>;
    totals_by_language_model: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        user_initiated_interaction_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        code_generation_activity_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        code_acceptance_activity_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        loc_suggested_to_add_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        loc_added_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        loc_deleted_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        language: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        model: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    }, z.core.$loose>>>>>;
    totals_by_model_feature: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        user_initiated_interaction_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        code_generation_activity_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        code_acceptance_activity_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        loc_suggested_to_add_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        loc_added_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        loc_deleted_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        model: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        feature: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    }, z.core.$loose>>>>>;
    user_initiated_interaction_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    code_generation_activity_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    code_acceptance_activity_count: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    loc_suggested_to_add_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    loc_added_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    loc_deleted_sum: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    daily_active_users: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    weekly_active_users: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    monthly_active_users: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    monthly_active_chat_users: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    monthly_active_agent_users: z.ZodCatch<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
}, z.core.$loose>]>;
/** The `download_links` envelope returned by the report endpoints. */
export declare const reportLinks: z.ZodObject<{
    download_links: z.ZodArray<z.ZodString>;
    report_day: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    report_start_day: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    report_end_day: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$loose>;
export type ReportRecord = z.infer<typeof reportRecord>;
/**
 * Parse a downloaded report file. Reports are newline-delimited JSON (one record per line), but a file that is
 * one JSON array or object (also what a one-line file is) is accepted too. Lines or records that are not valid
 * report records are counted in `malformed` and skipped.
 */
export declare function parseReportFile(text: string): {
    records: ReportRecord[];
    malformed: number;
};
/** One row of activity counts; a count the report does not give is null (printed as a dash in Markdown, never as 0). */
export type Activity = {
    [K in keyof typeof activity]: number | null;
};
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
    period: {
        start: string | null;
        end: string | null;
    };
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
    feature_engagement: {
        feature: string;
        engaged_user_count: number;
    }[];
    /** Sum over the period. `all` is the sum of the daily totals; the other two come from the feature breakdown. */
    activity: {
        all: Activity;
        code_completions: Activity | null;
        chat: Activity | null;
    };
    /** Complete breakdowns, sorted by prompts + generations (then lines added, then name), best first. */
    by_ide: BreakdownRow[];
    by_feature: BreakdownRow[];
    by_language: BreakdownRow[];
    by_model: BreakdownRow[];
    /** One row per dated day, oldest first. */
    daily: DailyRow[];
}
/** Aggregate parsed report records (a 28-day report or a single day) into the metrics summary data. */
export declare function buildMetricsSummary(org: string, records: ReportRecord[], malformed: number): MetricsSummary;
export {};
//# sourceMappingURL=metrics-report.d.ts.map