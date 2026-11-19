import * as z from "zod/v4";
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
/** Summarise parsed report records (a 28-day report or a single day) as compact Markdown. */
export declare function summarizeReports(org: string, records: ReportRecord[], malformed: number): string;
export {};
//# sourceMappingURL=metrics-report.d.ts.map