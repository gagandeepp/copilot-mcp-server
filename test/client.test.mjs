// In-process tests of dist/github-client.js with a stubbed fetch: headers, token origin guard, status -> message
// mapping, timeout, caller abort and pagination. (Each test file runs in its own process, so patching globals is safe.)
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

const { githubFetch, githubFetchAll, downloadReport, ApiError } = await import(new URL("../dist/github-client.js", import.meta.url));

let calls = [];
let responder;
const realTimeout = AbortSignal.timeout.bind(AbortSignal);
globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), headers: init.headers, signal: init.signal });
    return responder(String(url), init);
};
const res = (status, body, headers = {}) =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const headersOf = (i) => Object.fromEntries(new Headers(calls[i].headers));

afterEach(() => {
    calls = [];
    AbortSignal.timeout = realTimeout;
});

describe("github-client request headers", () => {
    it("sends the standard headers and the token only to api.github.com", async () => {
        responder = () => res(200, { ok: 1 });
        await githubFetch("/orgs/acme/copilot/billing", "tok");
        await githubFetch("https://copilot-reports.github.com/r/1.json?sig=abc", "tok");

        assert.equal(headersOf(0).authorization, "Bearer tok");
        assert.equal(headersOf(0).accept, "application/vnd.github+json");
        assert.equal(headersOf(0)["x-github-api-version"], "2022-11-28");
        assert.match(headersOf(0)["user-agent"], /^copilot-mcp-server\/\d+\.\d+\.\d+/);
        assert.equal(headersOf(1).authorization, undefined, "token must not go to non-api.github.com origins");
    });

    it("downloadReport never sends the token and refuses non-https links", async () => {
        responder = () => new Response("{}", { status: 200 });
        await downloadReport("https://copilot-reports.github.com/r/1.ndjson?sig=abc");
        assert.deepEqual(Object.keys(headersOf(0)), ["user-agent"]);
        await assert.rejects(downloadReport("http://copilot-reports.github.com/r/1.ndjson"), /not https/);
        await assert.rejects(downloadReport("not a url"), /not https/);
        assert.equal(calls.length, 1, "no request is made for a non-https link");
    });
});

describe("github-client status -> error mapping", () => {
    const cases = [
        [() => res(401, { message: "Bad credentials" }), 401, false, /GitHub rejected the token \(HTTP 401\).*GitHub says: "Bad credentials"/],
        [() => res(403, { message: "Must be an org owner" }), 403, false, /GitHub denied access \(HTTP 403\)/],
        [() => res(403, { message: "API rate limit exceeded" }, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1795000000" }), 403, true, /rate limit exceeded \(HTTP 403\)\. Retry after 2026-/],
        [() => res(403, { message: "secondary rate limit" }, { "retry-after": "60" }), 403, true, /rate limit exceeded \(HTTP 403\)\. Retry after 60 seconds/],
        [() => res(429, {}, { "retry-after": "30" }), 429, true, /rate limit exceeded \(HTTP 429\)\. Retry after 30 seconds/],
        [() => res(404, { message: "Not Found" }), 404, false, /Not found \(HTTP 404\)\. Check the org login with list_organizations/],
        [() => res(422, { message: "x".repeat(500) }), 422, false, /HTTP 422/],
        [() => res(503, "<html>upstream secret stack trace</html>"), 503, false, /GitHub returned HTTP 503\. Try again later\./],
        [() => res(418, {}), 418, false, /GitHub API returned HTTP 418\./],
    ];
    const how = ["", "", "via x-ratelimit-remaining + reset", "via retry-after", "via retry-after", "", "", "", ""];
    for (const [i, [make, status, rateLimited, re]] of cases.entries()) {
        it(`HTTP ${status}${rateLimited ? ` rate limited ${how[i]}` : ""}`, async () => {
            responder = make;
            const err = await githubFetch("/x", "tok").then(() => null, (e) => e);
            assert.ok(err instanceof ApiError);
            assert.equal(err.status, status);
            assert.equal(err.rateLimited, rateLimited);
            assert.match(err.message, re);
            assert.doesNotMatch(err.message, /upstream secret/, "raw non-JSON body must not leak");
            if (status === 422) assert.ok(err.message.length < 320, "GitHub's message must be truncated");
        });
    }
});

describe("github-client timeout, cancellation and pagination", () => {
    it("turns the 30 s timeout into a recovery message (shrunk for the test)", async () => {
        // AbortSignal.timeout timers are unref'd; keep the event loop alive like the stdio server does.
        const keepAlive = setInterval(() => {}, 1000);
        try {
            AbortSignal.timeout = () => realTimeout(50);
            responder = (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(init.signal.reason)));
            const err = await githubFetch("/slow", "tok").then(() => null, (e) => e);
            assert.match(err?.message ?? "", /did not respond within 30 seconds/);
        } finally {
            clearInterval(keepAlive);
        }
    });

    it("rethrows a caller abort instead of reporting it as a timeout", async () => {
        const keepAlive = setInterval(() => {}, 1000);
        try {
            AbortSignal.timeout = () => realTimeout(10_000);
            responder = (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(init.signal.reason)));
            const controller = new AbortController();
            setTimeout(() => controller.abort(), 30);
            const err = await githubFetch("/slow", "tok", controller.signal).then(() => null, (e) => e);
            assert.ok(err, "the request must reject");
            assert.doesNotMatch(err.message, /did not respond/);
        } finally {
            clearInterval(keepAlive);
        }
    });

    it("follows Link rel=next and keeps sending the token", async () => {
        responder = (url) =>
            url.includes("page=2")
                ? res(200, [{ id: 3 }])
                : res(200, [{ id: 1 }, { id: 2 }], { link: '<https://api.github.com/user/orgs?per_page=100&page=2>; rel="next"' });
        const all = await githubFetchAll("/user/orgs?per_page=100", "tok");
        assert.deepEqual(all.map((o) => o.id), [1, 2, 3]);
        assert.equal(headersOf(1).authorization, "Bearer tok");
    });

    it("returns null data for a 204", async () => {
        responder = () => new Response(null, { status: 204 });
        assert.equal(await githubFetch("/orgs/acme/copilot/metrics/reports/organization-1-day?day=2026-11-18", "tok"), null);
    });
});
