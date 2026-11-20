// MCP resources in both protocol eras: resources/list, resources/templates/list, resources/read (data equals the matching
// tool's JSON, errors, validation), cache hints (2026-07-28 only), completion of the {org} variable, and the
// resource_link block the billing and metrics tools add. Everything runs against the fetch mock; nothing touches the network.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { ProtocolError, ProtocolErrorCode, ResourceNotFoundError } from "@modelcontextprotocol/client";
import { ERAS, TOKEN, apiRequests, startServer } from "./helpers/harness.mjs";

const JSON_MIME = "application/json";
const BILLING_TEMPLATE = "copilot://orgs/{org}/billing";
const MOCK_ORGS = ["acme", "globex", "initech"]; // the `basic` scenario

// The SDK answers a resource miss with -32602 and data { uri } on every protocol era (it never emits -32002).
const NOT_FOUND_CODE = { modern: -32602, legacy: -32602 };

const bypass = { cacheMode: "bypass" };

/** Read a resource and return the single content item with its text parsed as JSON. */
async function readJson(client, uri) {
    const result = await client.readResource({ uri }, bypass);
    assert.equal(result.contents.length, 1, uri);
    const [item] = result.contents;
    assert.equal(item.uri, uri);
    assert.equal(item.mimeType, JSON_MIME);
    assert.equal(typeof item.text, "string");
    const data = JSON.parse(item.text);
    assert.equal(item.text, JSON.stringify(data, null, 2), "pretty-printed JSON, like the tools' text block");
    return { data, result };
}

async function readError(client, uri) {
    try {
        await client.readResource({ uri }, bypass);
    } catch (err) {
        return err;
    }
    return assert.fail(`reading ${uri} should have failed`);
}

/** structuredContent of a tool call in JSON mode. */
async function toolJson(server, tool, args) {
    const { result, text } = await server.call(tool, { ...args, response_format: "json" });
    assert.ok(!result.isError, text);
    return result.structuredContent;
}

const complete = (client, ref, name, value, context) =>
    client.complete({ ref, argument: { name, value }, ...(context ? { context } : {}) }).then((r) => r.completion);
const templateRef = (uri) => ({ type: "ref/resource", uri });

for (const { label, era, options } of ERAS) {
    describe(`resources [${label}]`, () => {
        let server;
        let client;
        before(async () => {
            server = await startServer({ options });
            client = server.client;
        });
        after(() => server.close());

        it("advertises the resources and completions capabilities", () => {
            const caps = client.getServerCapabilities();
            assert.ok(caps.resources);
            assert.ok(caps.prompts);
            assert.ok(caps.completions);
        });

        it("resources/list: copilot://orgs plus one billing and one 28-day entry per org, and no daily entries", async () => {
            const { resources } = await client.listResources(undefined, bypass);
            assert.deepEqual(resources.map((r) => r.uri), [
                "copilot://orgs",
                ...MOCK_ORGS.map((org) => `copilot://orgs/${org}/billing`),
                ...MOCK_ORGS.map((org) => `copilot://orgs/${org}/metrics/28-day`),
            ]);
            for (const r of resources) {
                assert.equal(r.mimeType, JSON_MIME, r.uri);
                assert.ok(r.name && r.title && r.description, r.uri);
            }
            const byUri = Object.fromEntries(resources.map((r) => [r.uri, r]));
            assert.equal(byUri["copilot://orgs/acme/billing"].name, "Copilot billing: acme");
            assert.equal(byUri["copilot://orgs/acme/billing"].title, "Copilot billing: acme");
            assert.equal(byUri["copilot://orgs/globex/metrics/28-day"].name, "Copilot 28-day metrics: globex");
        });

        it("resources/templates/list: the three templates", async () => {
            const { resourceTemplates } = await client.listResourceTemplates(undefined, bypass);
            assert.deepEqual(
                resourceTemplates.map((t) => t.uriTemplate),
                [BILLING_TEMPLATE, "copilot://orgs/{org}/metrics/28-day", "copilot://orgs/{org}/metrics/daily/{day}"]
            );
            assert.deepEqual(resourceTemplates.map((t) => t.name), ["copilot_billing", "copilot_metrics_28_day", "copilot_metrics_daily"]);
            for (const t of resourceTemplates) {
                assert.equal(t.mimeType, JSON_MIME, t.uriTemplate);
                assert.ok(t.title && t.description, t.uriTemplate);
            }
        });

        describe("reading", () => {
            it("copilot://orgs equals list_organizations in JSON mode", async () => {
                const { data } = await readJson(client, "copilot://orgs");
                assert.deepEqual(data, await toolJson(server, "list_organizations", {}));
                assert.equal(data.total_count, 3);
            });

            it("a billing URI equals get_copilot_billing_summary in JSON mode", async () => {
                for (const org of ["acme", "globex"]) {
                    const { data } = await readJson(client, `copilot://orgs/${org}/billing`);
                    assert.deepEqual(data, await toolJson(server, "get_copilot_billing_summary", { org }));
                    assert.equal(data.org, org);
                }
            });

            it("a 28-day URI equals get_copilot_metrics in JSON mode", async () => {
                const { data } = await readJson(client, "copilot://orgs/ok/metrics/28-day");
                assert.deepEqual(data, await toolJson(server, "get_copilot_metrics", { org: "ok" }));
                assert.equal(data.available, true);
                assert.equal(data.org, "ok");
            });

            it("a daily URI equals get_copilot_metrics with `day` in JSON mode", async () => {
                const { data } = await readJson(client, "copilot://orgs/ok/metrics/daily/2026-11-18");
                assert.deepEqual(data, await toolJson(server, "get_copilot_metrics", { org: "ok", day: "2026-11-18" }));
                assert.equal(data.available, true);
                assert.deepEqual(data.period, { start: "2026-11-18", end: "2026-11-18" });
            });

            it("a missing report (204 / no download links) is normal JSON content with available: false, not an error", async () => {
                const latest = await readJson(client, "copilot://orgs/nodata/metrics/28-day");
                assert.equal(latest.data.available, false);
                assert.equal(latest.data.org, "nodata");
                assert.match(latest.data.message, /no 28-day Copilot usage metrics report/);

                const daily = await readJson(client, "copilot://orgs/nodata/metrics/daily/2026-11-18");
                assert.deepEqual(daily.data, await toolJson(server, "get_copilot_metrics", { org: "nodata", day: "2026-11-18" }));
                assert.equal(daily.data.day, "2026-11-18");

                const noLinks = await readJson(client, "copilot://orgs/nolinks/metrics/28-day");
                assert.equal(noLinks.data.available, false);
                assert.match(noLinks.data.message, /no download links/);
            });

            it("sends the token to the GitHub API and passes the org through", async () => {
                const seen = server.stats().requests.length;
                await readJson(client, "copilot://orgs/globex/billing");
                const api = apiRequests(server.stats().requests.slice(seen));
                assert.deepEqual(api.map((r) => r.path), ["/orgs/globex/copilot/billing"]);
                assert.equal(api[0].headers.authorization, `Bearer ${TOKEN}`);
            });
        });

        describe("validation: bad input is InvalidParams (and never reaches GitHub)", () => {
            const BAD = [
                ["copilot://orgs/ok/metrics/daily/2026-13-45", /not a calendar date/],
                ["copilot://orgs/ok/metrics/daily/2026-02-30", /not a calendar date/],
                ["copilot://orgs/ok/metrics/daily/tomorrow", /YYYY-MM-DD/],
                ["copilot://orgs/ok/metrics/daily/20261118", /YYYY-MM-DD/],
                ["copilot://orgs/ok/metrics/daily/2026-1-8", /YYYY-MM-DD/],
                ["copilot://orgs/bad%20org/billing", /Invalid organization/],
                ["copilot://orgs/-acme/billing", /Invalid organization/],
                ["copilot://orgs/acme%2Fevil/metrics/28-day", /Invalid organization/],
                ["copilot://orgs/bad!org/metrics/daily/2026-11-18", /Invalid organization/],
                [`copilot://orgs/${"a".repeat(40)}/billing`, /Invalid organization/],
            ];
            for (const [uri, pattern] of BAD) {
                it(uri, async () => {
                    const seen = server.stats().requests.length;
                    const err = await readError(client, uri);
                    assert.ok(ProtocolError.isInstance(err), String(err));
                    assert.equal(err.code, ProtocolErrorCode.InvalidParams);
                    assert.match(err.message, pattern);
                    // InvalidParams with data exactly { uri } would be read as "not found"; this must not carry it.
                    assert.ok(!ResourceNotFoundError.isInstance(err));
                    assert.equal(err.data, undefined);
                    assert.deepEqual(server.stats().requests.slice(seen), [], "no GitHub request");
                });
            }
        });

        describe("failures", () => {
            it("a GitHub 404 is ResourceNotFoundError (-32602 with data { uri }) carrying the recovery message", async () => {
                for (const uri of ["copilot://orgs/initech/billing", "copilot://orgs/nosuch/metrics/28-day", "copilot://orgs/nosuch/metrics/daily/2026-11-18"]) {
                    const err = await readError(client, uri);
                    assert.ok(ResourceNotFoundError.isInstance(err), `${uri}: ${err}`);
                    assert.equal(err.code, NOT_FOUND_CODE[era]);
                    assert.equal(err.code, ProtocolErrorCode.InvalidParams);
                    assert.deepEqual(err.data, { uri });
                    assert.equal(err.uri, uri);
                    assert.match(err.message, /Not found \(HTTP 404\)/);
                }
                assert.match((await readError(client, "copilot://orgs/nosuch/metrics/28-day")).message, /"Copilot usage metrics" policy is enabled/, "metrics wording");
            });

            it("an unknown URI is ResourceNotFoundError too", async () => {
                for (const uri of ["copilot://nothing", "copilot://orgs/acme/seats", "copilot://orgs/acme/metrics/daily"]) {
                    const err = await readError(client, uri);
                    assert.ok(ResourceNotFoundError.isInstance(err), `${uri}: ${err}`);
                    assert.equal(err.code, NOT_FOUND_CODE[era]);
                    assert.deepEqual(err.data, { uri });
                }
            });

            it("a 403 is InternalError (-32603) with the tool's recovery message, not 'not found'", async () => {
                const billing = await readError(client, "copilot://orgs/owner/billing");
                assert.ok(!ResourceNotFoundError.isInstance(billing));
                assert.equal(billing.code, ProtocolErrorCode.InternalError);
                assert.equal(billing.data, undefined);
                assert.match(billing.message, /GitHub denied access \(HTTP 403\)\. Copilot billing data requires an organization owner token/);

                const metrics = await readError(client, "copilot://orgs/denied/metrics/28-day");
                assert.equal(metrics.code, ProtocolErrorCode.InternalError);
                assert.match(metrics.message, /Access denied \(HTTP 403\)\. Copilot usage metrics require an organization owner/);

                const daily = await readError(client, "copilot://orgs/denied/metrics/daily/2026-11-18");
                assert.equal(daily.code, ProtocolErrorCode.InternalError);
                assert.match(daily.message, /Access denied \(HTTP 403\)/);
            });

            it("rate limits, server errors and an empty report are InternalError with their messages", async () => {
                const rateLimited = await readError(client, "copilot://orgs/rl429/billing");
                assert.equal(rateLimited.code, ProtocolErrorCode.InternalError);
                assert.match(rateLimited.message, /rate limit exceeded \(HTTP 429\)\. Retry after 30 seconds/);

                const rateLimited403 = await readError(client, "copilot://orgs/rl403/billing");
                assert.equal(rateLimited403.code, ProtocolErrorCode.InternalError, "a rate-limited 403 is not a permissions problem");
                assert.match(rateLimited403.message, /rate limit exceeded \(HTTP 403\)/);

                const serverError = await readError(client, "copilot://orgs/err502/billing");
                assert.equal(serverError.code, ProtocolErrorCode.InternalError);
                assert.match(serverError.message, /GitHub returned HTTP 502\. Try again later/);

                const empty = await readError(client, "copilot://orgs/allbad/metrics/28-day");
                assert.equal(empty.code, ProtocolErrorCode.InternalError);
                assert.match(empty.message, /had no usable records/);

                const expired = await readError(client, "copilot://orgs/expired/metrics/28-day");
                assert.equal(expired.code, ProtocolErrorCode.InternalError);
                assert.match(expired.message, /report download link expired/);
            });
        });

        if (era === "modern") {
            describe("cache hints", () => {
                it("lists carry the configured ttlMs and cacheScope", async () => {
                    const resources = await client.listResources(undefined, bypass);
                    assert.equal(resources.ttlMs, 300_000);
                    assert.equal(resources.cacheScope, "private");
                    const templates = await client.listResourceTemplates(undefined, bypass);
                    assert.equal(templates.ttlMs, 3_600_000);
                    assert.equal(templates.cacheScope, "public");
                });

                it("reads carry the per-resource ttlMs and cacheScope", async () => {
                    const HOUR = 3_600_000;
                    const cases = [
                        ["copilot://orgs", HOUR],
                        ["copilot://orgs/acme/billing", 600_000],
                        ["copilot://orgs/ok/metrics/28-day", HOUR],
                        ["copilot://orgs/ok/metrics/daily/2026-11-18", 86_400_000],
                    ];
                    for (const [uri, ttlMs] of cases) {
                        const result = await client.readResource({ uri }, bypass);
                        assert.equal(result.ttlMs, ttlMs, uri);
                        assert.equal(result.cacheScope, "private", uri);
                    }
                });

                it("a repeated read is answered from the client's cache until it is bypassed", async () => {
                    const reports = () =>
                        apiRequests(server.stats().requests).filter((r) => r.path === "/orgs/ok/copilot/metrics/reports/organization-1-day").length;
                    const uri = "copilot://orgs/ok/metrics/daily/2026-11-16"; // a day no other test reads
                    const first = await client.readResource({ uri });
                    const afterFirst = reports();
                    const second = await client.readResource({ uri });
                    assert.deepEqual(second.contents, first.contents);
                    assert.equal(reports(), afterFirst, "the second read never reached the server");
                    await client.readResource({ uri }, bypass);
                    assert.equal(reports(), afterFirst + 1);
                });
            });
        } else {
            it("sends no cache fields to a 2025-era client", async () => {
                const resources = await client.listResources(undefined, bypass);
                assert.equal(resources.ttlMs, undefined);
                assert.equal(resources.cacheScope, undefined);
                const read = await client.readResource({ uri: "copilot://orgs" }, bypass);
                assert.equal(read.ttlMs, undefined);
                assert.equal(read.cacheScope, undefined);
            });
        }
    });

    describe(`resource completion [${label}]`, () => {
        const TEMPLATES = [
            BILLING_TEMPLATE,
            "copilot://orgs/{org}/metrics/28-day",
            "copilot://orgs/{org}/metrics/daily/{day}",
        ];

        it("completes {org} on all three templates, with prefix filtering that ignores case", async () => {
            const server = await startServer({ options, scenario: "mixedcase" });
            try {
                for (const uri of TEMPLATES) {
                    const all = await complete(server.client, templateRef(uri), "org", "");
                    assert.deepEqual(all.values, ["Acme-Corp", "acme-labs", "Beta"], uri);
                    assert.equal(all.hasMore, false);
                    assert.deepEqual((await complete(server.client, templateRef(uri), "org", "acme")).values, ["Acme-Corp", "acme-labs"], uri);
                    assert.deepEqual((await complete(server.client, templateRef(uri), "org", "ACME-C")).values, ["Acme-Corp"], uri);
                    assert.deepEqual((await complete(server.client, templateRef(uri), "org", "b")).values, ["Beta"], uri);
                    assert.deepEqual((await complete(server.client, templateRef(uri), "org", "cme")).values, [], "prefix, not substring");
                    assert.deepEqual((await complete(server.client, templateRef(uri), "org", "zzz")).values, []);
                }
            } finally {
                await server.close();
            }
        });

        it("completes the mock logins of the basic scenario", async () => {
            const server = await startServer({ options });
            try {
                assert.deepEqual((await complete(server.client, templateRef(BILLING_TEMPLATE), "org", "")).values, MOCK_ORGS);
                assert.deepEqual((await complete(server.client, templateRef(BILLING_TEMPLATE), "org", "g")).values, ["globex"]);
                assert.deepEqual((await complete(server.client, templateRef(BILLING_TEMPLATE), "org", "i")).values, ["initech"]);
            } finally {
                await server.close();
            }
        });

        it("the {day} variable has no completion", async () => {
            const server = await startServer({ options });
            try {
                const day = await complete(server.client, templateRef("copilot://orgs/{org}/metrics/daily/{day}"), "day", "2026");
                assert.deepEqual(day.values, []);
            } finally {
                await server.close();
            }
        });

        it("returns at most 100 suggestions", async () => {
            const server = await startServer({ options, scenario: "many" });
            try {
                const all = await complete(server.client, templateRef(BILLING_TEMPLATE), "org", "");
                assert.equal(all.values.length, 100);
                assert.equal(all.total, 100, "completeOrg itself caps at 100 (the SDK would report total 120 and hasMore if it returned every match)");
                assert.equal(all.values[0], "org-001");
                const some = await complete(server.client, templateRef(BILLING_TEMPLATE), "org", "org-11");
                assert.deepEqual(some.values, ["org-110", "org-111", "org-112", "org-113", "org-114", "org-115", "org-116", "org-117", "org-118", "org-119"]);
            } finally {
                await server.close();
            }
        });

        it("with no token it returns an empty list (not an error), and resources/list still lists copilot://orgs", async () => {
            const server = await startServer({ options, token: null });
            try {
                for (const uri of TEMPLATES) {
                    const result = await complete(server.client, templateRef(uri), "org", "a");
                    assert.deepEqual(result.values, []);
                }
                const { resources } = await server.client.listResources(undefined, bypass);
                assert.deepEqual(resources.map((r) => r.uri), ["copilot://orgs"]);
                assert.deepEqual(apiRequests(server.stats().requests), [], "no token, so no GitHub request at all");

                // Reading without a token is InternalError with the tool's recovery message (not "not found").
                for (const uri of ["copilot://orgs", "copilot://orgs/acme/billing", "copilot://orgs/ok/metrics/28-day", "copilot://orgs/ok/metrics/daily/2026-11-18"]) {
                    const err = await readError(server.client, uri);
                    assert.ok(!ResourceNotFoundError.isInstance(err), uri);
                    assert.equal(err.code, ProtocolErrorCode.InternalError, uri);
                    assert.match(err.message, /GITHUB_TOKEN environment variable is not set/, uri);
                }
                assert.deepEqual(apiRequests(server.stats().requests), []);
            } finally {
                await server.close();
            }
        });

        it("with a GitHub error it returns an empty list and does not cache the failure", async () => {
            const server = await startServer({ options, scenario: "flaky" });
            try {
                const failed = await complete(server.client, templateRef(BILLING_TEMPLATE), "org", "");
                assert.deepEqual(failed.values, []);
                const retried = await complete(server.client, templateRef(BILLING_TEMPLATE), "org", "");
                assert.deepEqual(retried.values, MOCK_ORGS, "the next call tries again");
                await complete(server.client, templateRef(BILLING_TEMPLATE), "org", "g");
                assert.equal(server.stats().requests.filter((r) => r.path === "/user/orgs").length, 2, "the success is cached");
            } finally {
                await server.close();
            }
        });

        it("resources/list and completions share one cached /user/orgs fetch", async () => {
            const server = await startServer({ options });
            try {
                await server.client.listResources(undefined, bypass);
                await complete(server.client, templateRef(BILLING_TEMPLATE), "org", "a");
                await complete(server.client, templateRef("copilot://orgs/{org}/metrics/28-day"), "org", "g");
                assert.equal(server.stats().requests.filter((r) => r.path === "/user/orgs").length, 1);
            } finally {
                await server.close();
            }
        });
    });

    describe(`tool resource links [${label}]`, () => {
        let server;
        before(async () => {
            server = await startServer({ options });
        });
        after(() => server.close());

        const link = (uri, name) => ({ type: "resource_link", uri, name, mimeType: JSON_MIME });

        it("get_copilot_billing_summary adds a resource_link after its text block, in both formats", async () => {
            for (const response_format of ["markdown", "json"]) {
                const { result } = await server.call("get_copilot_billing_summary", { org: "acme", response_format });
                assert.equal(result.content.length, 2, response_format);
                assert.equal(result.content[0].type, "text");
                assert.deepEqual(result.content[1], link("copilot://orgs/acme/billing", "Copilot billing: acme"));
            }
        });

        it("get_copilot_metrics links the 28-day resource, or the daily one when `day` is given", async () => {
            for (const response_format of ["markdown", "json"]) {
                const latest = await server.call("get_copilot_metrics", { org: "ok", response_format });
                assert.equal(latest.result.content.length, 2, response_format);
                assert.deepEqual(latest.result.content[1], link("copilot://orgs/ok/metrics/28-day", "Copilot 28-day metrics: ok"));

                const daily = await server.call("get_copilot_metrics", { org: "ok", day: "2026-11-18", response_format });
                assert.equal(daily.result.content.length, 2, response_format);
                assert.deepEqual(daily.result.content[1], link("copilot://orgs/ok/metrics/daily/2026-11-18", "Copilot metrics for 2026-11-18: ok"));
            }
        });

        it("a missing report (available: false) is still linked, since the resource answers the same", async () => {
            const { result } = await server.call("get_copilot_metrics", { org: "nodata", response_format: "json" });
            assert.equal(result.structuredContent.available, false);
            assert.equal(result.content.length, 2);
            assert.equal(result.content[1].uri, "copilot://orgs/nodata/metrics/28-day");
        });

        it("the linked resource returns the tool's JSON data", async () => {
            const { result } = await server.call("get_copilot_billing_summary", { org: "acme", response_format: "json" });
            const read = await server.client.readResource({ uri: result.content[1].uri }, bypass);
            assert.deepEqual(JSON.parse(read.contents[0].text), result.structuredContent);
        });

        it("errors and the other tools carry no link", async () => {
            const cases = [
                ["get_copilot_billing_summary", { org: "owner" }, true],
                ["get_copilot_metrics", { org: "denied" }, true],
                ["get_copilot_metrics", { org: "allbad" }, true],
                ["list_organizations", {}, false],
                ["get_copilot_seats", { org: "acme" }, false],
                ["get_copilot_usage_all_orgs", {}, false],
            ];
            for (const [tool, args, isError] of cases) {
                for (const response_format of ["markdown", "json"]) {
                    const { result } = await server.call(tool, { ...args, response_format });
                    assert.equal(Boolean(result.isError), isError, tool);
                    assert.equal(result.content.length, 1, `${tool} ${response_format}`);
                    assert.equal(result.content[0].type, "text");
                }
            }
        });
    });
}
