// MCP prompts in both protocol eras: prompts/list, prompts/get (embedded resources, notes when GitHub fails, argument
// validation and defaults) and completion of the `org` argument. Everything runs against the fetch mock.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { ProtocolError, ProtocolErrorCode } from "@modelcontextprotocol/client";
import { ERAS, apiRequests, startServer } from "./helpers/harness.mjs";

const JSON_MIME = "application/json";
const PROMPTS = ["copilot_inactive_seats_review", "copilot_adoption_report", "copilot_org_comparison", "copilot_billing_forecast"];
const MOCK_ORGS = ["acme", "globex", "initech"]; // the `basic` scenario
const DAY_MS = 86_400_000;

const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

const getPrompt = (client, name, args) => client.getPrompt({ name, arguments: args });
const texts = (result) => result.messages.map((m) => (m.content.type === "text" ? m.content.text : null));

async function promptError(client, name, args) {
    try {
        await getPrompt(client, name, args);
    } catch (err) {
        return err;
    }
    return assert.fail(`prompts/get ${name} ${JSON.stringify(args)} should have failed`);
}

const complete = (client, promptName, argName, value) =>
    client.complete({ ref: { type: "ref/prompt", name: promptName }, argument: { name: argName, value } }).then((r) => r.completion);

for (const { label, era, options } of ERAS) {
    describe(`prompts [${label}]`, () => {
        let server;
        let client;
        before(async () => {
            server = await startServer({ options });
            client = server.client;
        });
        after(() => server.close());

        it("prompts/list: the four prompts, in order, with titles, descriptions and arguments", async () => {
            const list = await client.listPrompts(undefined, { cacheMode: "bypass" });
            assert.deepEqual(list.prompts.map((p) => p.name), PROMPTS);
            for (const p of list.prompts) assert.ok(p.title && p.description, p.name);

            const args = Object.fromEntries(list.prompts.map((p) => [p.name, p.arguments]));
            assert.deepEqual(args.copilot_inactive_seats_review.map((a) => [a.name, a.required]), [["org", true], ["inactive_days", false]]);
            assert.deepEqual(args.copilot_adoption_report.map((a) => [a.name, a.required]), [["org", true]]);
            assert.deepEqual(args.copilot_org_comparison.map((a) => [a.name, a.required]), [["min_active_pct", false]]);
            assert.deepEqual(args.copilot_billing_forecast.map((a) => [a.name, a.required]), [["org", true]]);
            for (const list of Object.values(args)) for (const a of list) assert.ok(a.description, `${a.name} is described`);
            assert.match(args.copilot_inactive_seats_review[1].description, /default 30/);
            assert.match(args.copilot_org_comparison[0].description, /default 50/);
        });

        if (era === "modern") {
            it("prompts/list carries the configured cache hint", async () => {
                const list = await client.listPrompts(undefined, { cacheMode: "bypass" });
                assert.equal(list.ttlMs, 3_600_000);
                assert.equal(list.cacheScope, "public");
            });
        } else {
            it("prompts/list sends no cache fields to a 2025-era client", async () => {
                const list = await client.listPrompts();
                assert.equal(list.ttlMs, undefined);
                assert.equal(list.cacheScope, undefined);
            });
        }

        describe("copilot_adoption_report", () => {
            it("embeds the billing and 28-day resources (the same text resources/read returns), then the instructions", async () => {
                const result = await getPrompt(client, "copilot_adoption_report", { org: "both" });
                assert.equal(result.messages.length, 3);
                assert.ok(result.messages.every((m) => m.role === "user"));

                const [billing, metrics, instructions] = result.messages.map((m) => m.content);
                assert.equal(billing.type, "resource");
                assert.equal(billing.resource.uri, "copilot://orgs/both/billing");
                assert.equal(billing.resource.mimeType, JSON_MIME);
                assert.equal(metrics.type, "resource");
                assert.equal(metrics.resource.uri, "copilot://orgs/both/metrics/28-day");
                assert.equal(metrics.resource.mimeType, JSON_MIME);
                assert.equal(instructions.type, "text");

                for (const { resource } of [billing, metrics]) {
                    const read = await client.readResource({ uri: resource.uri }, { cacheMode: "bypass" });
                    assert.equal(resource.text, read.contents[0].text, `${resource.uri}: embedded text equals the resource`);
                }
                assert.equal(JSON.parse(billing.resource.text).seat_breakdown.total, 20);
                assert.equal(JSON.parse(metrics.resource.text).available, true);

                assert.match(instructions.text, /organization "both"/);
                assert.match(instructions.text, /Adoption rate: seat_breakdown\.active_this_cycle divided by seat_breakdown\.total/);
                assert.match(instructions.text, /Engaged and active users/);
                assert.match(instructions.text, /Completions versus chat/);
                assert.match(instructions.text, /top IDEs, languages and models/);
                assert.match(instructions.text, /Exactly three concrete, prioritised recommendations/);
            });

            it("with GitHub denying access, the embeds become notes naming the tools, and the call still succeeds", async () => {
                const result = await getPrompt(client, "copilot_adoption_report", { org: "forbidden" });
                assert.equal(result.messages.length, 3);
                const [billing, metrics, instructions] = texts(result);
                assert.ok(texts(result).every((t) => t !== null), "no embedded resource blocks");
                assert.match(billing, /copilot:\/\/orgs\/forbidden\/billing/);
                assert.match(billing, /could not be loaded/);
                assert.match(billing, /GitHub denied access \(HTTP 403\)/);
                assert.match(billing, /Call the get_copilot_billing_summary tool with org "forbidden" and response_format "json"/);
                assert.match(metrics, /copilot:\/\/orgs\/forbidden\/metrics\/28-day/);
                assert.match(metrics, /Access denied \(HTTP 403\)\. Copilot usage metrics require/, "the metrics wording, not the billing one");
                assert.match(metrics, /Call the get_copilot_metrics tool with org "forbidden" and response_format "json"/);
                assert.match(instructions, /Exactly three concrete/);
                assert.match(instructions, /could not be loaded/, "the instructions tell the model what to do with a note");
            });

            it("one failing embed does not affect the other", async () => {
                const result = await getPrompt(client, "copilot_adoption_report", { org: "acme" }); // billing works, no metrics for acme (404)
                const kinds = result.messages.map((m) => m.content.type);
                assert.deepEqual(kinds, ["resource", "text", "text"]);
                assert.equal(result.messages[0].content.resource.uri, "copilot://orgs/acme/billing");
                assert.match(result.messages[1].content.text, /copilot:\/\/orgs\/acme\/metrics\/28-day.*could not be loaded.*Not found \(HTTP 404\)/s);
            });

            it("a missing metrics report is embedded as normal JSON (available: false), not as a note", async () => {
                const result = await getPrompt(client, "copilot_adoption_report", { org: "nodata" });
                const metrics = result.messages[1].content;
                assert.equal(metrics.type, "resource");
                assert.equal(JSON.parse(metrics.resource.text).available, false);
            });

            it("rejects a missing or invalid org with InvalidParams", async () => {
                for (const args of [{}, { org: "" }, { org: "bad org!" }, { org: "-acme" }, { org: "acme", extra: "1" }]) {
                    const err = await promptError(client, "copilot_adoption_report", args);
                    assert.ok(ProtocolError.isInstance(err), JSON.stringify(args));
                    assert.equal(err.code, ProtocolErrorCode.InvalidParams, JSON.stringify(args));
                }
            });
        });

        describe("copilot_billing_forecast", () => {
            it("embeds the billing resource, then the instructions", async () => {
                const result = await getPrompt(client, "copilot_billing_forecast", { org: "both" });
                assert.equal(result.messages.length, 2);
                assert.ok(result.messages.every((m) => m.role === "user"));
                const [billing, instructions] = result.messages.map((m) => m.content);
                assert.equal(billing.type, "resource");
                assert.equal(billing.resource.uri, "copilot://orgs/both/billing");
                assert.equal(billing.resource.mimeType, JSON_MIME);
                const data = JSON.parse(billing.resource.text);
                assert.equal(data.seat_breakdown.added_this_cycle, 4);
                assert.equal(data.seat_breakdown.pending_invitation, 2);
                assert.equal(data.seat_breakdown.pending_cancellation, 1);
                assert.equal(instructions.type, "text");
                assert.match(instructions.text, /added_this_cycle/);
                assert.match(instructions.text, /pending_invitation/);
                assert.match(instructions.text, /pending_cancellation/);
                assert.match(instructions.text, /total \+ pending_invitation - pending_cancellation/);
                assert.match(instructions.text, /next billing cycle/);
            });

            it("with a 403 the embed becomes a note and the call still succeeds", async () => {
                const result = await getPrompt(client, "copilot_billing_forecast", { org: "forbidden" });
                assert.equal(result.messages.length, 2);
                const [note, instructions] = texts(result);
                assert.match(note, /copilot:\/\/orgs\/forbidden\/billing/);
                assert.match(note, /GitHub denied access \(HTTP 403\)/);
                assert.match(note, /Call the get_copilot_billing_summary tool with org "forbidden"/);
                assert.match(instructions, /next billing cycle/);
            });

            it("rejects a missing or invalid org", async () => {
                for (const args of [{}, { org: "no spaces" }]) {
                    const err = await promptError(client, "copilot_billing_forecast", args);
                    assert.equal(err.code, ProtocolErrorCode.InvalidParams);
                }
            });
        });

        describe("copilot_org_comparison", () => {
            it("is one instruction message that sends the model to get_copilot_usage_all_orgs, with the default threshold 50", async () => {
                const seen = server.stats().requests.length;
                const result = await getPrompt(client, "copilot_org_comparison");
                assert.equal(result.messages.length, 1);
                assert.equal(result.messages[0].role, "user");
                const [text] = texts(result);
                assert.match(text, /get_copilot_usage_all_orgs tool with response_format "json"/);
                assert.match(text, /below 50%/);
                assert.match(text, /status "skipped".*"failed"/s);
                assert.match(text, /"incomplete" is true/);
                assert.deepEqual(server.stats().requests.slice(seen), [], "the prompt itself fetches nothing");
            });

            it("takes min_active_pct", async () => {
                assert.match(texts(await getPrompt(client, "copilot_org_comparison", { min_active_pct: "75" }))[0], /below 75%/);
                assert.match(texts(await getPrompt(client, "copilot_org_comparison", { min_active_pct: "0" }))[0], /below 0%/);
                assert.match(texts(await getPrompt(client, "copilot_org_comparison", { min_active_pct: "100" }))[0], /below 100%/);
                assert.equal(
                    texts(await getPrompt(client, "copilot_org_comparison", { min_active_pct: "50" }))[0],
                    texts(await getPrompt(client, "copilot_org_comparison", {}))[0],
                    "50 is the default"
                );
            });

            it("rejects anything but a whole number from 0 to 100, and unknown arguments", async () => {
                for (const value of ["abc", "-5", "5.5", "", " 50", "101", "1000", "50%"]) {
                    const err = await promptError(client, "copilot_org_comparison", { min_active_pct: value });
                    assert.ok(ProtocolError.isInstance(err), value);
                    assert.equal(err.code, ProtocolErrorCode.InvalidParams, value);
                    assert.match(err.message, /min_active_pct/, value);
                }
                const unknown = await promptError(client, "copilot_org_comparison", { threshold: "50" });
                assert.equal(unknown.code, ProtocolErrorCode.InvalidParams);
            });
        });

        describe("copilot_inactive_seats_review", () => {
            it("defaults inactive_days to 30 and sends the model to get_copilot_seats with JSON and per_page 100", async () => {
                const seen = server.stats().requests.length;
                const before = Date.now();
                const result = await getPrompt(client, "copilot_inactive_seats_review", { org: "acme" });
                const after = Date.now();
                assert.equal(result.messages.length, 1, "seats are a tool, so nothing is embedded");
                assert.equal(result.messages[0].role, "user");
                const [text] = texts(result);
                assert.match(text, /organization "acme"/);
                assert.match(text, /get_copilot_seats tool with org "acme", response_format "json" and per_page 100/);
                assert.match(text, /until has_more is false/);
                assert.match(text, /last_activity_at is null \(never used\) or older than 30 days/);
                assert.match(text, /pending_cancellation_date/);
                assert.match(text, /by team/);
                assert.match(text, /per-seat monthly list price you assume/);
                assert.match(text, /plan_type/);
                assert.match(text, /removal-candidate table/);

                const cutoff = text.match(/older than 30 days, which means before (\d{4}-\d{2}-\d{2})/)[1];
                assert.ok([isoDay(before - 30 * DAY_MS), isoDay(after - 30 * DAY_MS)].includes(cutoff), cutoff);
                const today = text.match(/Today is (\d{4}-\d{2}-\d{2}) \(UTC\)/)[1];
                assert.ok([isoDay(before), isoDay(after)].includes(today), today);
                assert.deepEqual(server.stats().requests.slice(seen), [], "the prompt itself fetches nothing");
            });

            it("takes inactive_days, and an explicit 30 equals the default", async () => {
                const seven = texts(await getPrompt(client, "copilot_inactive_seats_review", { org: "acme", inactive_days: "7" }))[0];
                assert.match(seven, /older than 7 days, which means before \d{4}-\d{2}-\d{2}/);
                assert.ok(!/older than 30 days/.test(seven));
                const defaulted = texts(await getPrompt(client, "copilot_inactive_seats_review", { org: "acme" }))[0];
                const explicit = texts(await getPrompt(client, "copilot_inactive_seats_review", { org: "acme", inactive_days: "30" }))[0];
                assert.equal(explicit, defaulted);
            });

            it("rejects non-digit inactive_days, a bad org and unknown arguments with InvalidParams", async () => {
                const bad = [
                    { org: "acme", inactive_days: "abc" },
                    { org: "acme", inactive_days: "3x" },
                    { org: "acme", inactive_days: "-1" },
                    { org: "acme", inactive_days: "1.5" },
                    { org: "acme", inactive_days: "" },
                    { org: "acme", inactive_days: " 7" },
                    { org: "acme", inactive_days: "12345" },
                    { org: "acme", days: "7" },
                    { org: "bad org!" },
                    {},
                ];
                for (const args of bad) {
                    const err = await promptError(client, "copilot_inactive_seats_review", args);
                    assert.ok(ProtocolError.isInstance(err), JSON.stringify(args));
                    assert.equal(err.code, ProtocolErrorCode.InvalidParams, JSON.stringify(args));
                }
                const digits = await promptError(client, "copilot_inactive_seats_review", { org: "acme", inactive_days: "3x" });
                assert.match(digits.message, /inactive_days: Use a whole number of days/);
            });
        });

        it("an unknown prompt is InvalidParams", async () => {
            const err = await promptError(client, "copilot_nope", {});
            assert.equal(err.code, ProtocolErrorCode.InvalidParams);
            assert.match(err.message, /not found/);
        });
    });

    describe(`prompt completion [${label}]`, () => {
        it("completes the org argument of the three org prompts, filtered by prefix", async () => {
            const server = await startServer({ options, scenario: "mixedcase" });
            try {
                for (const prompt of ["copilot_inactive_seats_review", "copilot_adoption_report", "copilot_billing_forecast"]) {
                    assert.deepEqual((await complete(server.client, prompt, "org", "")).values, ["Acme-Corp", "acme-labs", "Beta"], prompt);
                    assert.deepEqual((await complete(server.client, prompt, "org", "ACME")).values, ["Acme-Corp", "acme-labs"], prompt);
                    assert.deepEqual((await complete(server.client, prompt, "org", "be")).values, ["Beta"], prompt);
                    assert.deepEqual((await complete(server.client, prompt, "org", "zzz")).values, [], prompt);
                }
            } finally {
                await server.close();
            }
        });

        it("returns the mock logins, and nothing for the other arguments", async () => {
            const server = await startServer({ options });
            try {
                assert.deepEqual((await complete(server.client, "copilot_adoption_report", "org", "")).values, MOCK_ORGS);
                assert.deepEqual((await complete(server.client, "copilot_adoption_report", "org", "i")).values, ["initech"]);
                assert.deepEqual((await complete(server.client, "copilot_inactive_seats_review", "inactive_days", "")).values, []);
                assert.deepEqual((await complete(server.client, "copilot_org_comparison", "min_active_pct", "")).values, []);
            } finally {
                await server.close();
            }
        });

        it("with no token it returns an empty list (not an error), and prompts/get still succeeds with notes", async () => {
            const server = await startServer({ options, token: null });
            try {
                assert.deepEqual((await complete(server.client, "copilot_adoption_report", "org", "a")).values, []);

                const result = await getPrompt(server.client, "copilot_adoption_report", { org: "acme" });
                assert.equal(result.messages.length, 3);
                const [billing, metrics] = texts(result);
                assert.match(billing, /GITHUB_TOKEN environment variable is not set/);
                assert.match(billing, /Call the get_copilot_billing_summary tool with org "acme"/);
                assert.match(metrics, /GITHUB_TOKEN environment variable is not set/);
                assert.match(metrics, /Call the get_copilot_metrics tool with org "acme"/);
                assert.deepEqual(apiRequests(server.stats().requests), [], "no token, so no GitHub request at all");
            } finally {
                await server.close();
            }
        });
    });
}
