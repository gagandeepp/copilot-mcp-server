// Protocol-level checks in both eras: connection, tool list (titles, annotations, schemas, cache hints), server
// identity and instructions, and input validation. The server runs WITHOUT a token, so a call that passes validation
// fails with the "GITHUB_TOKEN ... not set" error, which is how these tests tell "accepted" from "rejected".
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { ERAS, REPO, startServer } from "./helpers/harness.mjs";

const pkgVersion = JSON.parse(readFileSync(path.join(REPO, "package.json"), "utf8")).version;

const TITLES = {
    list_organizations: "List Organizations",
    get_copilot_billing_summary: "Copilot Billing Summary",
    get_copilot_seats: "Copilot Seat Assignments",
    get_copilot_metrics: "Copilot Usage Metrics",
    get_copilot_usage_all_orgs: "Copilot Usage Across All Orgs",
};
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
const TOKEN_ERROR = /GITHUB_TOKEN environment variable is not set/;

// [tool, args, shouldPassValidation]
const CASES = [
    ["get_copilot_seats", { org: "acme", page: 0 }, false],
    ["get_copilot_seats", { org: "acme", page: 1.5 }, false],
    ["get_copilot_seats", { org: "acme", per_page: 101 }, false],
    ["get_copilot_seats", { org: "acme", page: 2 }, true],
    ["get_copilot_seats", { org: "acme" }, true],
    ["get_copilot_billing_summary", { org: "bad org!" }, false],
    ["get_copilot_billing_summary", { org: "-acme" }, false],
    ["get_copilot_billing_summary", { org: "a".repeat(40) }, false],
    ["get_copilot_billing_summary", { org: "" }, false],
    ["get_copilot_billing_summary", { org: "acme", bogus: 1 }, false],
    ["get_copilot_billing_summary", { org: "my-company" }, true],
    ["get_copilot_billing_summary", { org: "Acme_Corp9" }, true],
    ["get_copilot_metrics", { org: "acme", day: "2026/01/01" }, false],
    ["get_copilot_metrics", { org: "acme", day: "2026-01-01&per_page=100" }, false],
    ["get_copilot_metrics", { org: "acme", day: "tomorrow" }, false],
    ["get_copilot_metrics", { org: "acme", since: "2026-01-01" }, false],
    ["get_copilot_metrics", { org: "acme", until: "2026-11-19" }, false],
    ["get_copilot_metrics", { org: "acme", day: "2026-01-01" }, true],
    ["get_copilot_metrics", { org: "acme" }, true],
    // The two formerly argument-less tools now take response_format and still reject anything else.
    ["list_organizations", {}, true],
    ["list_organizations", { response_format: "json" }, true],
    ["list_organizations", { bogus: 1 }, false],
    ["get_copilot_usage_all_orgs", {}, true],
    ["get_copilot_usage_all_orgs", { response_format: "markdown" }, true],
    ["get_copilot_usage_all_orgs", { bogus: 1 }, false],
    // response_format is an enum on every tool.
    ["list_organizations", { response_format: "xml" }, false],
    ["get_copilot_billing_summary", { org: "acme", response_format: "yaml" }, false],
    ["get_copilot_seats", { org: "acme", response_format: "" }, false],
    ["get_copilot_metrics", { org: "acme", response_format: "JSON" }, false],
    ["get_copilot_usage_all_orgs", { response_format: 1 }, false],
];

for (const { label, era, options } of ERAS) {
    describe(`protocol [${label}]`, () => {
        let server;
        let client;
        let list;
        before(async () => {
            server = await startServer({ options, token: null });
            client = server.client;
            list = await client.listTools();
        });
        after(() => server.close());

        it("negotiates the expected protocol era", () => {
            assert.equal(client.getProtocolEra(), era);
        });

        it("reports server identity from package.json and usage instructions", () => {
            const info = client.getServerVersion();
            assert.equal(info.name, "github-copilot-usage");
            assert.equal(info.version, pkgVersion);
            assert.equal(info.title, "GitHub Copilot Usage");
            assert.match(client.getInstructions() ?? "", /Call list_organizations first/);
        });

        it("lists the five tools with titles and read-only annotations", () => {
            assert.deepEqual(list.tools.map((t) => t.name).sort(), Object.keys(TITLES).sort());
            for (const tool of list.tools) {
                assert.equal(tool.title, TITLES[tool.name], `title for ${tool.name}`);
                assert.deepEqual(tool.annotations, READ_ONLY, `annotations for ${tool.name}`);
            }
        });

        it("declares no outputSchema (the output shape depends on response_format)", () => {
            for (const tool of list.tools) assert.equal(tool.outputSchema, undefined, tool.name);
        });

        it("gives every tool a strict schema with an optional response_format enum defaulting to markdown", () => {
            for (const tool of list.tools) {
                const schema = tool.inputSchema;
                assert.equal(schema.additionalProperties, false, `${tool.name} is strict`);
                const rf = schema.properties.response_format;
                assert.deepEqual(rf.enum, ["markdown", "json"], tool.name);
                assert.equal(rf.default, "markdown", tool.name);
                assert.ok(rf.description, `${tool.name} describes response_format`);
                assert.ok(!(schema.required ?? []).includes("response_format"), `${tool.name}: response_format is optional`);
            }
        });

        it("keeps the existing parameters (page/per_page defaults; metrics takes day, not since/until)", () => {
            const byName = Object.fromEntries(list.tools.map((t) => [t.name, t.inputSchema]));
            assert.equal(byName.get_copilot_seats.properties.page.default, 1);
            assert.equal(byName.get_copilot_seats.properties.per_page.default, 50);
            assert.deepEqual(Object.keys(byName.get_copilot_metrics.properties).sort(), ["day", "org", "response_format"]);
            assert.deepEqual(byName.get_copilot_metrics.required, ["org"]);
            assert.deepEqual(Object.keys(byName.list_organizations.properties), ["response_format"]);
            assert.deepEqual(Object.keys(byName.get_copilot_usage_all_orgs.properties), ["response_format"]);
        });

        if (era === "modern") {
            it("hints that the static tool list may be cached for an hour", () => {
                assert.equal(list.ttlMs, 3_600_000);
                assert.equal(list.cacheScope, "public");
            });
        }

        for (const [name, args, shouldPass] of CASES) {
            it(`${shouldPass ? "accepts" : "rejects"} ${name} ${JSON.stringify(args)}`, async () => {
                const { result, text } = await server.call(name, args);
                assert.equal(result.isError, true, "without a token every call is an error");
                assert.equal(TOKEN_ERROR.test(text), shouldPass, text);
            });
        }
    });
}

describe("protocol [auto negotiation]", () => {
    it("connects in the modern era and answers a call", async () => {
        const server = await startServer({ options: { versionNegotiation: { mode: "auto" } }, token: null });
        try {
            assert.equal(server.client.getProtocolEra(), "modern");
            const { result, text } = await server.call("list_organizations");
            assert.equal(result.isError, true);
            assert.match(text, TOKEN_ERROR);
        } finally {
            await server.close();
        }
    });
});
