// get_copilot_metrics end to end through a real client (both protocol eras) against the fetch mock, which plays
// both the GitHub reports API and the signed download host; plus unit tests of the report parser on the docs fixtures.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { ERAS, FIXTURES, TOKEN, apiRequests, downloadRequests, startServer } from "./helpers/harness.mjs";

const { parseReportFile, buildMetricsSummary } = await import(new URL("../dist/metrics-report.js", import.meta.url));

for (const { label, options } of ERAS) {
    describe(`get_copilot_metrics [${label}]`, () => {
        let server;
        let seen = 0;
        before(async () => {
            server = await startServer({ options });
        });
        after(() => server.close());

        /** Call the tool; `reqs` are the requests the mock saw during this call only. */
        const call = async (args) => {
            const { result, text } = await server.call("get_copilot_metrics", args);
            const all = server.stats().requests;
            const reqs = all.slice(seen);
            seen = all.length;
            return { result, text, reqs, api: apiRequests(reqs), dl: downloadRequests(reqs) };
        };

        it("28-day report: requests, no token on the download, and the summary", async () => {
            const { result, text, api, dl } = await call({ org: "ok" });
            assert.ok(!result.isError, text);

            assert.deepEqual(api.map((q) => q.path + q.search), ["/orgs/ok/copilot/metrics/reports/organization-28-day/latest"]);
            assert.equal(api[0].headers.authorization, `Bearer ${TOKEN}`, "the API call carries the token (so the no-token check below is not vacuous)");
            assert.equal(api[0].headers["x-github-api-version"], "2022-11-28");
            assert.equal(dl.length, 1, "one download");
            assert.equal(dl[0].host, "copilot-reports.github.com");
            assert.equal(dl[0].headers.authorization, undefined, "the download request must carry NO Authorization header");
            assert.deepEqual(Object.keys(dl[0].headers).sort(), ["user-agent"], "the download sends only the User-Agent");
            assert.match(dl[0].headers["user-agent"], /^copilot-mcp-server\//);

            assert.match(text, /Period: 2026-11-17 to 2026-11-19 · 3 day\(s\) of data/);
            assert.match(text, /\| Daily active \(2026-11-19\) \| 4 \|/);
            assert.match(text, /\| Monthly active \(trailing 28 days\) \| 11 \|/, "monthly active comes from the latest day, never summed");
            assert.match(text, /\| Peak daily active \| 4 \|/);
            assert.match(text, /\| Average daily active \| 3 \|/);
            assert.match(text, /Feature engagement.*chat 7, code_completion 9/);
            assert.match(text, /\| All activity \| 60 \| 48 \| 24 \| 600 \| 360 \|/, "headline activity = sum of the per-day top-level fields");
            assert.match(text, /\| Code completions \| 0 \| 30 \| 18 \| 420 \| 240 \|/);
            assert.match(text, /\| Chat \| 60 \| 18 \| 6 \| 138 \| 120 \|/);
            assert.match(text, /### By language, top 10 of 14/);
            assert.match(text, /\| typescript \| — \| 21 \| 9 \| 135 \| 105 \|/, "language rows have no prompts: a dash, not 0");
            assert.match(text, /### By model \(chat only\)/);
            assert.match(text, /\| claude-sonnet-4\.6 \| 30 \|/);
            assert.ok(!text.includes("SHOULD-NOT-APPEAR"), "model_feature and language_model must not be mixed");
            assert.match(text, /\| jetbrains\\\|evil name \|/, "a pipe in a name is escaped and a newline becomes a space");
            assert.match(text, /### Daily\n\| Day /);
            assert.equal((text.match(/^\| 2026-11-1\d \|/gm) ?? []).length, 3, "3 daily rows");
            assert.ok(!text.includes("malformed"));
        });

        it("28-day report with a null copilot_feature_engagement has no engagement line", async () => {
            const { result, text } = await call({ org: "nullengage" });
            assert.ok(!result.isError, text);
            assert.ok(!text.includes("Feature engagement"));
        });

        it("concatenates several download links", async () => {
            const { result, text, dl } = await call({ org: "multi" });
            assert.ok(!result.isError, text);
            assert.equal(dl.length, 2);
            assert.ok(dl.every((q) => q.headers.authorization === undefined));
            assert.match(text, /· 6 day\(s\) of data/);
        });

        it("single-day report", async () => {
            const { result, text, api, dl } = await call({ org: "ok", day: "2026-11-18" });
            assert.ok(!result.isError, text);
            assert.deepEqual(api.map((q) => q.path + q.search), ["/orgs/ok/copilot/metrics/reports/organization-1-day?day=2026-11-18"]);
            assert.equal(dl[0].headers.authorization, undefined);
            assert.match(text, /_Day: 2026-11-18 · 1 day\(s\) of data_/);
            assert.match(text, /\| Daily active \(2026-11-18\) \| 3 \|/);
            assert.ok(!text.includes("Peak daily"), "no peak/average for a single day");
            assert.ok(!text.includes("### Daily"), "no per-day table for one day");
            assert.ok(!text.includes("Feature engagement"), "engagement exists only in 28-day reports");
        });

        it("a 204 means no report yet: a message, not an error", async () => {
            let r = await call({ org: "nodata", day: "2026-11-18" });
            assert.ok(!r.result.isError, "204 is not an error");
            assert.match(r.text, /No Copilot usage metrics report exists for 2026-11-18 in org "nodata"/);
            assert.match(r.text, /from 2025-10-10 and up to one year back/);
            r = await call({ org: "nodata" });
            assert.ok(!r.result.isError);
            assert.match(r.text, /no 28-day Copilot usage metrics report for org "nodata" yet/);
        });

        it("a 403 from the reports API shows GitHub's message and downloads nothing", async () => {
            const { result, text, dl } = await call({ org: "denied" });
            assert.equal(result.isError, true);
            assert.match(text, /HTTP 403/);
            assert.match(text, /GitHub says: "Insufficient permissions\. This action requires admin, or relevant organization role access\."/);
            assert.equal(dl.length, 0);
        });

        it("an expired download link says to call again and never echoes the signed host's body", async () => {
            const { result, text, dl } = await call({ org: "expired" });
            assert.equal(result.isError, true);
            assert.match(text, /download link expired or is invalid\. Call the tool again/);
            assert.ok(!text.includes("AuthenticationFailed"));
            assert.equal(dl[0].headers.authorization, undefined);
        });

        it("reports other download failures by status", async () => {
            const { result, text } = await call({ org: "server500" });
            assert.equal(result.isError, true);
            assert.match(text, /Report download failed \(HTTP 500\)\./);
        });

        it("counts and skips a malformed NDJSON line", async () => {
            const { result, text } = await call({ org: "malformed", day: "2026-11-18" });
            assert.ok(!result.isError, text);
            assert.match(text, /_Skipped 1 malformed line\(s\) in the report\._/);
            assert.match(text, /### Active Users/);
        });

        it("a report with nothing usable is an error (shown without the 'Error:' prefix)", async () => {
            let r = await call({ org: "allbad" });
            assert.equal(r.result.isError, true);
            assert.match(r.text, /no usable records \(3 malformed line\(s\) skipped\)/);
            assert.ok(!r.text.startsWith("Error:"));
            r = await call({ org: "empty" });
            assert.equal(r.result.isError, true);
            assert.match(r.text, /no usable records \(0 malformed/);
        });

        it("rejects files over 25 MB, by content-length and while streaming", async () => {
            let r = await call({ org: "bigcl" });
            assert.equal(r.result.isError, true);
            assert.match(r.text, /larger than 25 MB/);
            r = await call({ org: "bigstream" });
            assert.equal(r.result.isError, true);
            assert.match(r.text, /larger than 25 MB/);
            const pulled = server.stats().bigStreamPulled;
            assert.ok(pulled >= 26 && pulled <= 30, `the stream must be cancelled right after the cap, pulled ${pulled} of 60 MB chunks`);
        });

        it("keeps multi-byte characters split across stream chunks intact", async () => {
            const { result, text } = await call({ org: "utf8" });
            assert.ok(!result.isError, text);
            assert.match(text, /日本語-é-🚀/);
            assert.ok(!text.includes("�"), "no replacement characters");
        });

        it("refuses non-https links, bad envelopes and reports with no links", async () => {
            let r = await call({ org: "httplink" });
            assert.equal(r.result.isError, true);
            assert.match(r.text, /not https/);
            assert.equal(r.dl.length, 0, "no request is made for a non-https link");
            r = await call({ org: "badenvelope" });
            assert.equal(r.result.isError, true);
            assert.match(r.text, /unexpected response \(no download_links\)/);
            r = await call({ org: "nolinks" });
            assert.ok(!r.result.isError);
            assert.match(r.text, /no download links/);
        });

        it("rejects since/until, other unknown keys and a malformed day", async () => {
            for (const args of [
                { org: "ok", since: "2026-11-01" },
                { org: "ok", until: "2026-11-19" },
                { org: "ok", day: "2026/11/18" },
                { org: "ok", day: "tomorrow" },
            ]) {
                const { result } = await server.call("get_copilot_metrics", args);
                assert.equal(result.isError, true, JSON.stringify(args));
            }
        });
    });

    describe(`get_copilot_metrics timeout [${label}]`, () => {
        it("gives up on a hanging download with a recovery message (timeout shrunk inside the server)", async () => {
            const server = await startServer({ options, mockTimeoutMs: 300 });
            try {
                const started = Date.now();
                const { result, text } = await server.call("get_copilot_metrics", { org: "hang" });
                assert.equal(result.isError, true);
                assert.match(text, /GitHub did not respond within 30 seconds\. Try again later\./);
                assert.ok(Date.now() - started < 10_000);
                assert.deepEqual(server.stats().aborted, ["hang"], "the hanging download was aborted");
            } finally {
                await server.close();
            }
        });
    });
}

describe("usage-metrics report parsing (docs fixtures)", () => {
    const read = (name) => readFileSync(path.join(FIXTURES, name), "utf8");

    it("parses the documented enterprise example (a JSON array of two 28-day records)", () => {
        const { records, malformed } = parseReportFile(read("docs-enterprise-example-schema.json"));
        assert.equal(records.length, 2);
        assert.equal(malformed, 0);
        const summary = buildMetricsSummary("acme", records, malformed);
        assert.equal(summary.day_count, 2);
        assert.deepEqual(summary.period, { start: "2025-09-04", end: "2025-10-01" });
        assert.equal(summary.active_users.daily, 2);
    });

    it("counts rows that are not report records as malformed instead of failing", () => {
        const { records, malformed } = parseReportFile(read("docs-team-level-user-teams-sample.ndjson"));
        assert.equal(records.length, 2);
        assert.equal(malformed, 1);
    });

    it("reads the same 28-day report as NDJSON or as a pretty-printed array", () => {
        const ndjson = parseReportFile(read("derived/org-28-day.ndjson"));
        const pretty = parseReportFile(read("derived/org-28-day-pretty-array.json"));
        assert.deepEqual(buildMetricsSummary("acme", ndjson.records, 0), buildMetricsSummary("acme", pretty.records, 0));
    });
});
