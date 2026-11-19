// The calls whose Markdown output is pinned under test/fixtures/golden/<name>.md.
// The goldens were captured from the server as it was BEFORE the data/render refactor (commit 69808bf), so they prove the
// refactor kept the output byte-identical. The one intended difference: the shared cell() helper now escapes '|' as '\|'
// where the old metrics code replaced it with a space. The derived metrics fixtures contain an IDE named
// "jetbrains|evil<newline>name", so the five metrics goldens that include it were edited on that single row
// ("jetbrains evil name" -> "jetbrains\|evil name") and are otherwise exactly as captured. The inputs of the other
// tools avoid '|' and newlines in user-controlled strings; those cases are covered in markdown.test.mjs.
//
// scenario: which /user/orgs list the mock serves (the other endpoints are keyed by org login).
// isError: the result is an error text (still pinned byte for byte).

const metrics = (name, args, extra = {}) => ({ name: `metrics-${name}`, scenario: "basic", tool: "get_copilot_metrics", args, ...extra });

export const GOLDEN_CASES = [
    { name: "list-organizations", scenario: "basic", tool: "list_organizations", args: {} },
    { name: "list-organizations-empty", scenario: "none", tool: "list_organizations", args: {} },

    { name: "billing-summary", scenario: "basic", tool: "get_copilot_billing_summary", args: { org: "acme" } },
    { name: "billing-summary-enterprise", scenario: "basic", tool: "get_copilot_billing_summary", args: { org: "globex" } },
    { name: "billing-error-403", scenario: "basic", tool: "get_copilot_billing_summary", args: { org: "owner" }, isError: true },
    { name: "billing-error-404", scenario: "basic", tool: "get_copilot_billing_summary", args: { org: "initech" }, isError: true },

    { name: "seats-page-1-more-available", scenario: "basic", tool: "get_copilot_seats", args: { org: "acme" } },
    { name: "seats-page-2-per-page-100", scenario: "basic", tool: "get_copilot_seats", args: { org: "acme", page: 2, per_page: 100 } },
    { name: "seats-last-page", scenario: "basic", tool: "get_copilot_seats", args: { org: "globex" } },
    { name: "seats-empty", scenario: "basic", tool: "get_copilot_seats", args: { org: "empty", page: 3 } },

    metrics("28-day", { org: "ok" }),
    metrics("28-day-null-engagement", { org: "nullengage" }),
    metrics("multiple-download-links", { org: "multi" }),
    metrics("1-day", { org: "ok", day: "2026-11-18" }),
    metrics("1-day-one-malformed-line", { org: "malformed", day: "2026-11-18" }),
    metrics("multibyte-names", { org: "utf8" }),
    metrics("no-report-for-day", { org: "nodata", day: "2026-11-18" }),
    metrics("no-28-day-report-yet", { org: "nodata" }),
    metrics("no-download-links", { org: "nolinks" }),
    metrics("no-usable-records", { org: "allbad" }, { isError: true }),
    metrics("error-403", { org: "denied" }, { isError: true }),

    { name: "all-orgs-mixed", scenario: "classify", tool: "get_copilot_usage_all_orgs", args: {} },
    { name: "all-orgs-skipped-only", scenario: "basic", tool: "get_copilot_usage_all_orgs", args: {} },
    { name: "all-orgs-all-ok", scenario: "clean", tool: "get_copilot_usage_all_orgs", args: {} },
    { name: "all-orgs-none", scenario: "none", tool: "get_copilot_usage_all_orgs", args: {} },
];
