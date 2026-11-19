// response_format: "json" for every tool, in both protocol eras. For each call: structuredContent deep-equals the
// parsed text block, the data matches the documented shape (strict schemas below, so an extra or missing key fails),
// and a few concrete values are pinned. Errors stay plain isError text in both formats.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import * as z from "zod/v4";
import { ERAS, startServer } from "./helpers/harness.mjs";

// ---- documented shapes ---------------------------------------------------------------------------------------
const int = z.number().int();
const str = z.string();
const nullableStr = z.string().nullable();
const count = z.number().nullable();

const seatBreakdown = z.strictObject({
    total: int,
    added_this_cycle: int,
    pending_cancellation: int,
    pending_invitation: int,
    active_this_cycle: int,
    inactive_this_cycle: int,
});

const organizationsShape = z.strictObject({
    total_count: int,
    organizations: z.array(z.strictObject({ id: int, login: str, description: str })),
});

const billingShape = z.strictObject({
    org: str,
    plan_type: str,
    seat_management_setting: str,
    seat_breakdown: seatBreakdown,
    features: z.strictObject({ public_code_suggestions: str, ide_chat: str, platform_chat: str, cli: str }),
});

const seatsShape = z.strictObject({
    org: str,
    page: int,
    per_page: int,
    total_seats: int,
    count: int,
    has_more: z.boolean(),
    next_page: int.optional(),
    seats: z.array(
        z.strictObject({
            login: str,
            type: str,
            team: nullableStr,
            plan_type: str,
            last_activity_at: nullableStr,
            last_authenticated_at: nullableStr,
            last_activity_editor: nullableStr,
            pending_cancellation_date: nullableStr,
            created_at: str,
        })
    ),
});

const activityFields = {
    user_initiated_interaction_count: count,
    code_generation_activity_count: count,
    code_acceptance_activity_count: count,
    loc_suggested_to_add_sum: count,
    loc_added_sum: count,
    loc_deleted_sum: count,
};
const activity = z.strictObject(activityFields);
const breakdownRows = z.array(z.strictObject({ name: str, ...activityFields }));

const metricsSummaryShape = z.strictObject({
    org: str,
    available: z.literal(true),
    period: z.strictObject({ start: nullableStr, end: nullableStr }),
    day_count: int,
    malformed_lines: int,
    active_users: z.strictObject({
        as_of_day: nullableStr,
        daily: count,
        weekly: count,
        monthly: count,
        monthly_chat: count,
        monthly_agent: count,
        peak_daily: count,
        average_daily: count,
    }),
    feature_engagement: z.array(z.strictObject({ feature: str, engaged_user_count: z.number() })),
    activity: z.strictObject({ all: activity, code_completions: activity.nullable(), chat: activity.nullable() }),
    by_ide: breakdownRows,
    by_feature: breakdownRows,
    by_language: breakdownRows,
    by_model: breakdownRows,
    daily: z.array(z.strictObject({ day: str, daily_active_users: count, ...activityFields })),
});

const metricsUnavailableShape = z.strictObject({ org: str, day: str.optional(), available: z.literal(false), message: str });

const usageShape = z.strictObject({
    organizations_scanned: int,
    totals: z.strictObject({ seats: int, active: int, inactive: int }),
    organizations: z.array(
        z.discriminatedUnion("status", [
            z.strictObject({ login: str, status: z.literal("ok"), plan_type: str, seat_breakdown: seatBreakdown }),
            z.strictObject({ login: str, status: z.literal("skipped"), reason: str }),
            z.strictObject({ login: str, status: z.literal("failed"), reason: str }),
        ])
    ),
    skipped_count: int,
    failed_count: int,
    incomplete: z.boolean(),
});

// ---- helpers -------------------------------------------------------------------------------------------------
/** Call a tool in JSON mode, check the invariants every JSON result shares, and return the data. */
async function callJson(server, tool, args, shape) {
    const { result, text } = await server.call(tool, { ...args, response_format: "json" });
    assert.ok(!result.isError, text);
    assert.equal(result.content.length, 1);
    assert.equal(result.content[0].type, "text");
    assert.ok(result.structuredContent && typeof result.structuredContent === "object" && !Array.isArray(result.structuredContent));
    assert.deepEqual(JSON.parse(text), result.structuredContent, "the text block is the same data as structuredContent");
    assert.equal(text, JSON.stringify(result.structuredContent, null, 2), "the text block is pretty-printed JSON");
    const parsed = shape.safeParse(result.structuredContent);
    assert.ok(parsed.success, `shape mismatch: ${parsed.error && JSON.stringify(parsed.error.issues, null, 2)}`);
    return result.structuredContent;
}

const seat = (login, extra = {}) => ({
    login,
    type: "User",
    team: null,
    plan_type: "business",
    last_activity_at: "2026-11-01T00:00:00Z",
    last_authenticated_at: null,
    last_activity_editor: "vscode",
    pending_cancellation_date: null,
    created_at: "2026-01-01T00:00:00Z",
    ...extra,
});

for (const { label, options } of ERAS) {
    describe(`JSON mode [${label}]`, () => {
        const servers = {};
        before(async () => {
            for (const scenario of ["basic", "classify", "clean", "none"]) servers[scenario] = await startServer({ options, scenario });
        });
        after(async () => {
            await Promise.all(Object.values(servers).map((s) => s.close()));
        });

        it("list_organizations", async () => {
            const data = await callJson(servers.basic, "list_organizations", {}, organizationsShape);
            assert.deepEqual(data, {
                total_count: 3,
                organizations: [
                    { id: 1, login: "acme", description: "Acme Corp" },
                    { id: 2, login: "globex", description: "" },
                    { id: 3, login: "initech", description: "Initech - TPS reports" },
                ],
            });
        });

        it("list_organizations with no organizations", async () => {
            const data = await callJson(servers.none, "list_organizations", {}, organizationsShape);
            assert.deepEqual(data, { total_count: 0, organizations: [] });
        });

        it("get_copilot_billing_summary", async () => {
            const data = await callJson(servers.basic, "get_copilot_billing_summary", { org: "acme" }, billingShape);
            assert.deepEqual(data, {
                org: "acme",
                plan_type: "business",
                seat_management_setting: "assign_selected",
                seat_breakdown: {
                    total: 25,
                    added_this_cycle: 3,
                    pending_cancellation: 2,
                    pending_invitation: 1,
                    active_this_cycle: 20,
                    inactive_this_cycle: 5,
                },
                features: { public_code_suggestions: "block", ide_chat: "enabled", platform_chat: "enabled", cli: "enabled" },
            });
        });

        it("get_copilot_seats: a page with more to come has next_page", async () => {
            const data = await callJson(servers.basic, "get_copilot_seats", { org: "acme" }, seatsShape);
            assert.deepEqual(data, {
                org: "acme",
                page: 1,
                per_page: 50,
                total_seats: 250,
                count: 2,
                has_more: true,
                next_page: 2,
                seats: [
                    seat("alice", {
                        team: "Platform",
                        last_authenticated_at: "2026-11-18T09:00:00Z",
                        last_activity_editor: "vscode/1.99.0/copilot-chat/0.26.0",
                        pending_cancellation_date: "2026-12-01",
                    }),
                    seat("bob", { plan_type: "enterprise", last_activity_at: null, last_activity_editor: null }),
                ],
            });
        });

        it("get_copilot_seats: paging arguments reach the data", async () => {
            const data = await callJson(servers.basic, "get_copilot_seats", { org: "acme", page: 2, per_page: 100 }, seatsShape);
            assert.equal(data.page, 2);
            assert.equal(data.per_page, 100);
            assert.equal(data.next_page, 3);
        });

        it("get_copilot_seats: the last page has no next_page key at all", async () => {
            const data = await callJson(servers.basic, "get_copilot_seats", { org: "globex" }, seatsShape);
            assert.equal(data.has_more, false);
            assert.equal("next_page" in data, false);
            assert.equal(data.count, 1);
            assert.deepEqual(data.seats, [seat("carol", { team: "Data" })]);
        });

        it("get_copilot_seats: an empty page is the full shape with no seats", async () => {
            const data = await callJson(servers.basic, "get_copilot_seats", { org: "empty", page: 3 }, seatsShape);
            assert.deepEqual(data, { org: "empty", page: 3, per_page: 50, total_seats: 0, count: 0, has_more: false, seats: [] });
        });

        it("get_copilot_metrics: the 28-day summary", async () => {
            const data = await callJson(servers.basic, "get_copilot_metrics", { org: "ok" }, metricsSummaryShape);
            assert.equal(data.available, true);
            assert.deepEqual(data.period, { start: "2026-11-17", end: "2026-11-19" });
            assert.equal(data.day_count, 3);
            assert.equal(data.malformed_lines, 0);
            assert.deepEqual(data.active_users, {
                as_of_day: "2026-11-19",
                daily: 4,
                weekly: 7,
                monthly: 11,
                monthly_chat: 7,
                monthly_agent: 0,
                peak_daily: 4,
                average_daily: 3,
            });
            assert.deepEqual(data.feature_engagement, [
                { feature: "chat", engaged_user_count: 7 },
                { feature: "code_completion", engaged_user_count: 9 },
            ]);

            const shown = (a) => [
                a.user_initiated_interaction_count,
                a.code_generation_activity_count,
                a.code_acceptance_activity_count,
                a.loc_suggested_to_add_sum,
                a.loc_added_sum,
            ];
            assert.deepEqual(shown(data.activity.all), [60, 48, 24, 600, 360]);
            assert.deepEqual(shown(data.activity.code_completions), [0, 30, 18, 420, 240]);
            assert.deepEqual(shown(data.activity.chat), [60, 18, 6, 138, 120]);

            // JSON carries complete breakdowns (the Markdown shows only the top 10) with raw, unescaped names.
            assert.equal(data.by_language.length, 14);
            assert.equal(data.by_language[0].name, "typescript");
            assert.deepEqual(shown(data.by_language[0]), [null, 21, 9, 135, 105], "a count the report lacks is null, not 0");
            assert.deepEqual(data.by_ide.map((r) => r.name), ["vscode", "jetbrains|evil\nname"]);
            assert.equal(data.by_model[0].name, "claude-sonnet-4.6");
            assert.equal(data.by_model[0].user_initiated_interaction_count, 30);

            assert.deepEqual(data.daily.map((d) => d.day), ["2026-11-17", "2026-11-18", "2026-11-19"]);
            assert.deepEqual(data.daily.map((d) => d.daily_active_users), [2, 3, 4]);
            assert.deepEqual(shown(data.daily[0]), [10, 8, 4, 100, 60]);
        });

        it("get_copilot_metrics: a single day has no peak/average and one daily row", async () => {
            const data = await callJson(servers.basic, "get_copilot_metrics", { org: "ok", day: "2026-11-18" }, metricsSummaryShape);
            assert.deepEqual(data.period, { start: "2026-11-18", end: "2026-11-18" });
            assert.equal(data.day_count, 1);
            assert.equal(data.active_users.daily, 3);
            assert.equal(data.active_users.peak_daily, null);
            assert.equal(data.active_users.average_daily, null);
            assert.deepEqual(data.feature_engagement, []);
            assert.equal(data.daily.length, 1);
        });

        it("get_copilot_metrics: counts malformed lines and keeps multi-byte names", async () => {
            const malformed = await callJson(servers.basic, "get_copilot_metrics", { org: "malformed", day: "2026-11-18" }, metricsSummaryShape);
            assert.equal(malformed.malformed_lines, 1);
            const utf8 = await callJson(servers.basic, "get_copilot_metrics", { org: "utf8" }, metricsSummaryShape);
            assert.deepEqual(utf8.by_language.map((r) => r.name), ["日本語-é-🚀"]);
            assert.equal(utf8.activity.code_completions, null);
            assert.equal(utf8.activity.chat, null);
        });

        it("get_copilot_metrics: no report is { available: false, message }", async () => {
            const forDay = await callJson(servers.basic, "get_copilot_metrics", { org: "nodata", day: "2026-11-18" }, metricsUnavailableShape);
            assert.equal(forDay.available, false);
            assert.equal(forDay.day, "2026-11-18");
            assert.match(forDay.message, /No Copilot usage metrics report exists for 2026-11-18 in org "nodata"/);

            const latest = await callJson(servers.basic, "get_copilot_metrics", { org: "nodata" }, metricsUnavailableShape);
            assert.equal("day" in latest, false, "day is present only when a day was requested");
            assert.match(latest.message, /no 28-day Copilot usage metrics report for org "nodata" yet/);

            const noLinks = await callJson(servers.basic, "get_copilot_metrics", { org: "nolinks" }, metricsUnavailableShape);
            assert.match(noLinks.message, /no download links/);
        });

        it("get_copilot_usage_all_orgs: classification, order and totals", async () => {
            const data = await callJson(servers.classify, "get_copilot_usage_all_orgs", {}, usageShape);
            assert.deepEqual(data.organizations.map((o) => `${o.login}:${o.status}`), [
                "ok-1:ok", "ok-2:ok", "ok-3:ok", "ok-4:ok", "ok-5:ok", "ok-6:ok",
                "nocop:skipped", "owner:skipped",
                "rl403:failed", "rl429:failed", "err502:failed", "net:failed",
            ]);
            assert.deepEqual(data.organizations[0], {
                login: "ok-1",
                status: "ok",
                plan_type: "business",
                seat_breakdown: { total: 10, added_this_cycle: 0, pending_cancellation: 0, pending_invitation: 0, active_this_cycle: 6, inactive_this_cycle: 4 },
            });
            assert.deepEqual(data.organizations.slice(6).map((o) => o.reason), [
                "No Copilot subscription or no access",
                "Insufficient permissions (requires org owner with manage_billing:copilot or read:org)",
                "HTTP 403 (rate limited)",
                "HTTP 429 (rate limited)",
                "HTTP 502",
                "request failed (fetch failed)",
            ]);
            assert.equal(data.organizations_scanned, 12);
            assert.deepEqual(data.totals, { seats: 60, active: 36, inactive: 24 });
            assert.equal(data.skipped_count, 2);
            assert.equal(data.failed_count, 4);
            assert.equal(data.incomplete, true);
        });

        it("get_copilot_usage_all_orgs: complete when nothing failed, and with no organizations", async () => {
            const clean = await callJson(servers.clean, "get_copilot_usage_all_orgs", {}, usageShape);
            assert.equal(clean.incomplete, false);
            assert.equal(clean.failed_count, 0);
            assert.equal(clean.skipped_count, 0);
            assert.deepEqual(clean.totals, { seats: 20, active: 12, inactive: 8 });

            const none = await callJson(servers.none, "get_copilot_usage_all_orgs", {}, usageShape);
            assert.deepEqual(none, {
                organizations_scanned: 0,
                totals: { seats: 0, active: 0, inactive: 0 },
                organizations: [],
                skipped_count: 0,
                failed_count: 0,
                incomplete: false,
            });
        });

        it("errors stay isError text in JSON mode, with no structuredContent", async () => {
            const cases = [
                ["get_copilot_billing_summary", { org: "owner" }, /^Error: GitHub denied access \(HTTP 403\)/],
                ["get_copilot_seats", { org: "owner" }, /^Error: GitHub denied access \(HTTP 403\)/],
                ["get_copilot_metrics", { org: "denied" }, /^Error: Access denied \(HTTP 403\)/],
                ["get_copilot_metrics", { org: "allbad" }, /^The Copilot usage metrics report for org "allbad" had no usable records/],
            ];
            for (const [tool, args, pattern] of cases) {
                const { result, text } = await servers.basic.call(tool, { ...args, response_format: "json" });
                assert.equal(result.isError, true, tool);
                assert.equal(result.structuredContent, undefined, tool);
                assert.equal(result.content.length, 1);
                assert.match(text, pattern);
            }
        });
    });
}
