// End-to-end checks through a real client against the fetch mock, in both protocol eras:
// the all-orgs summary (classification, order, concurrency, progress), seats paging, and cancellation.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { ERAS, apiRequests, startServer } from "./helpers/harness.mjs";

const until = async (predicate, timeoutMs = 5000) => {
    const deadline = Date.now() + timeoutMs;
    while (!predicate()) {
        if (Date.now() > deadline) throw new Error("timed out waiting for condition");
        await new Promise((resolve) => setTimeout(resolve, 25));
    }
};

for (const { label, options } of ERAS) {
    describe(`get_copilot_usage_all_orgs [${label}]`, () => {
        let server;
        let result;
        let text;
        let progress;
        before(async () => {
            server = await startServer({ options, scenario: "classify" });
            progress = [];
            ({ result, text } = await server.call("get_copilot_usage_all_orgs", {}, { onprogress: (p) => progress.push(p) }));
        });
        after(() => server.close());

        const rows = () => text.split("\n").filter((line) => /^\| (ok-|nocop|owner|rl|err|net)/.test(line));

        it("lists successes, then skipped, then failed, each in the original org order", () => {
            assert.ok(!result.isError, text);
            assert.deepEqual(rows().map((line) => line.split("|")[1].trim()), [
                "ok-1", "ok-2", "ok-3", "ok-4", "ok-5", "ok-6", "nocop", "owner", "rl403", "rl429", "err502", "net",
            ]);
        });

        it("classifies 404 and 403 as skipped and a rate-limited 403 as a failure", () => {
            const r = rows();
            assert.match(r[6], /No Copilot subscription or no access/);
            assert.match(r[7], /Insufficient permissions/);
            assert.match(r[8], /HTTP 403 \(rate limited\)/, "a rate-limited 403 is a failure, not 'insufficient permissions'");
            assert.match(r[9], /HTTP 429 \(rate limited\)/);
            assert.match(r[10], /Error: HTTP 502/);
            assert.match(r[11], /Error: request failed \(fetch failed\)/);
        });

        it("totals only the orgs that answered and flags the result as incomplete", () => {
            assert.match(text, /Organizations scanned: 12/);
            assert.match(text, /Total Copilot seats: 60/);
            assert.match(text, /2 org\(s\) skipped/);
            assert.match(text, /\*\*Warning:\*\* 4 org\(s\) failed/);
        });

        it("scans at most 5 orgs at a time, and more than one", () => {
            const { maxInflight } = server.stats();
            assert.ok(maxInflight > 1 && maxInflight <= 5, `concurrency must be 2..5, got ${maxInflight}`);
        });

        it("sends one progress notification per org", () => {
            assert.equal(progress.length, 12);
            assert.equal(progress.at(-1).progress, 12);
            assert.equal(progress.at(-1).total, 12);
            assert.deepEqual(progress.map((p) => p.progress), [...progress.map((p) => p.progress)].sort((a, b) => a - b), "progress never goes backwards");
        });
    });

    describe(`get_copilot_seats [${label}]`, () => {
        let server;
        before(async () => {
            server = await startServer({ options });
        });
        after(() => server.close());

        it("passes per_page and page upstream and shows the Last Auth column and the next-page hint", async () => {
            const { result, text } = await server.call("get_copilot_seats", { org: "acme", page: 2, per_page: 100 });
            assert.ok(!result.isError, text);
            assert.ok(apiRequests(server.stats().requests).some((r) => r.search.includes("per_page=100") && r.search.includes("page=2")));
            assert.match(text, /Last Auth/);
            assert.match(text, /2026-11-18T09:00:00Z/);
            assert.match(text, /Use page=3 \(per_page=100\)/);
        });

        it("rejects per_page above 100", async () => {
            const { result } = await server.call("get_copilot_seats", { org: "acme", per_page: 101 });
            assert.equal(result.isError, true);
        });

        it("aborts the upstream GitHub request when the client cancels the call", async () => {
            const controller = new AbortController();
            setTimeout(() => controller.abort(), 300);
            await server.call("get_copilot_seats", { org: "hang" }, { signal: controller.signal }).catch(() => {});
            await until(() => server.stats().aborted.length > 0);
            assert.deepEqual(server.stats().aborted, ["/orgs/hang/copilot/billing/seats"], "client cancel must abort the GitHub request");
        });
    });
}
