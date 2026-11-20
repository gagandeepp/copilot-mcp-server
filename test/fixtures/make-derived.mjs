// Builds DERIVED fixtures (not from the docs) from the verbatim docs enterprise example:
// organization scope (organization_id), 3 days, non-empty model arrays, explicit nulls, unknown extra fields.
// Run from anywhere: node test/fixtures/make-derived.mjs (writes test/fixtures/derived/).
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const docs = JSON.parse(readFileSync(path.join(HERE, "docs-enterprise-example-schema.json"), "utf8"));
const base = docs[0];
const clone = (o) => JSON.parse(JSON.stringify(o));

const chat = (feature, interactions, gens, acc, add) => ({
  feature, user_initiated_interaction_count: interactions, code_generation_activity_count: gens,
  code_acceptance_activity_count: acc, loc_suggested_to_add_sum: add + 3, loc_suggested_to_delete_sum: 0, loc_added_sum: add, loc_deleted_sum: 0,
});
function day(d, n) {
  const e = clone(base.day_totals[0]);
  e.day = d;
  delete e.enterprise_id;
  e.organization_id = "4242";
  e.enterprise_id = "1";
  e.daily_active_users = 2 + n;
  e.weekly_active_users = 5 + n;
  e.monthly_active_users = 9 + n;          // trailing-28d distinct count: must NOT be summed
  e.monthly_active_chat_users = 7;
  e.user_initiated_interaction_count = 10 * (n + 1);
  e.code_generation_activity_count = 8 * (n + 1);
  e.code_acceptance_activity_count = 4 * (n + 1);
  e.loc_suggested_to_add_sum = 100 * (n + 1);
  e.loc_added_sum = 60 * (n + 1);
  e.loc_deleted_sum = 5;
  e.daily_active_copilot_app_users = null;               // nullable per docs
  e.pull_requests.median_minutes_to_merge = null;
  e.totals_by_cli = null;
  e.totals_by_copilot_app = null;
  e.brand_new_field_from_the_future = { anything: [1, 2, 3] };
  e.totals_by_feature = [
    { ...e.totals_by_feature[0], code_generation_activity_count: 5 * (n + 1), code_acceptance_activity_count: 3 * (n + 1), loc_added_sum: 40 * (n + 1), loc_suggested_to_add_sum: 70 * (n + 1) },
    chat("chat_panel_agent_mode", 6 * (n + 1), 3 * (n + 1), 1 * (n + 1), 20 * (n + 1)),
    chat("chat_inline", 4 * (n + 1), 0, 0, 0),
    { feature: "agent_edit", loc_added_sum: 15, loc_deleted_sum: 2 },
  ];
  e.totals_by_ide = [
    { ide: "vscode", user_initiated_interaction_count: 8 * (n + 1), code_generation_activity_count: 6 * (n + 1), code_acceptance_activity_count: 3 * (n + 1), loc_suggested_to_add_sum: 80, loc_added_sum: 50 },
    { ide: "jetbrains|evil\nname", user_initiated_interaction_count: 2, code_generation_activity_count: 1, code_acceptance_activity_count: 1, loc_suggested_to_add_sum: 20, loc_added_sum: 10 },
  ];
  e.totals_by_language_feature = [
    { language: "typescript", feature: "code_completion", code_generation_activity_count: 3 * (n + 1), code_acceptance_activity_count: 2, loc_suggested_to_add_sum: 40, loc_added_sum: 30 },
    { language: "python", feature: "chat_panel_agent_mode", code_generation_activity_count: 2, code_acceptance_activity_count: 1, loc_suggested_to_add_sum: 20, loc_added_sum: 10 },
    { language: "typescript", feature: "chat_inline", code_generation_activity_count: 1, code_acceptance_activity_count: 1, loc_suggested_to_add_sum: 5, loc_added_sum: 5 },
  ];
  e.totals_by_model_feature = [
    { model: "claude-sonnet-4.6", feature: "chat_panel_agent_mode", user_initiated_interaction_count: 5 * (n + 1), code_generation_activity_count: 3, code_acceptance_activity_count: 1, loc_suggested_to_add_sum: 20, loc_added_sum: 10 },
    { model: "gpt-5.4", feature: "chat_inline", user_initiated_interaction_count: 3, code_generation_activity_count: 1, code_acceptance_activity_count: 1, loc_suggested_to_add_sum: 5, loc_added_sum: 5 },
  ];
  e.totals_by_language_model = [
    { language: "python", model: "SHOULD-NOT-APPEAR-when-model_feature-present", user_initiated_interaction_count: 99 },
  ];
  return e;
}
// 12 extra languages so the top-10 cap is exercised
const days = [day("2026-11-17", 0), day("2026-11-18", 1), day("2026-11-19", 2)];
for (let i = 0; i < 12; i++) days[2].totals_by_language_feature.push({ language: `lang${i}`, feature: "code_completion", code_generation_activity_count: 1, code_acceptance_activity_count: 1, loc_added_sum: 1, loc_suggested_to_add_sum: 1 });

const wrapper = {
  organization_id: "4242", enterprise_id: "1", report_start_day: "2026-11-17", report_end_day: "2026-11-19",
  created_at: "2026-11-20T01:00:00Z", day_totals: days,
  copilot_feature_engagement: { active_user_count: 11, totals_by_feature: [{ feature: "chat", engaged_user_count: 7 }, { feature: "code_completion", engaged_user_count: 9 }] },
};
const out = path.join(HERE, "derived");
writeFileSync(`${out}/org-28-day.ndjson`, JSON.stringify(wrapper) + "\n");
writeFileSync(`${out}/org-28-day-pretty-array.json`, JSON.stringify([wrapper], null, 2));
// 28-day record with null feature engagement
writeFileSync(`${out}/org-28-day-null-engagement.ndjson`, JSON.stringify({ ...wrapper, copilot_feature_engagement: null }) + "\n");
const one = clone(days[1]);
writeFileSync(`${out}/org-1-day.ndjson`, JSON.stringify(one) + "\n");
// one good 1-day line + one broken line
writeFileSync(`${out}/org-1-day-one-malformed-line.ndjson`, JSON.stringify(one) + "\n" + '{"day":"2026-11-18","daily_active_users":' + "\n");
console.log("ok");
