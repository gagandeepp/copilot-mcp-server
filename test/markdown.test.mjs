// cell(): user-controlled strings placed in Markdown table cells must not break the row.
// Unit tests of the helper, then end to end through the tools with the mock's "escaping" scenario, which serves an
// org description, team name, editor name and plan type containing '|' and newlines.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { ERAS, startServer } from "./helpers/harness.mjs";

const { cell } = await import(new URL("../dist/markdown.js", import.meta.url));

/** Number of '|' in a line that are not escaped as '\|': the column separators. */
const separators = (line) => (line.match(/(?<!\\)\|/g) ?? []).length;
const tableLines = (text) => text.split("\n").filter((line) => line.startsWith("|"));

describe("cell()", () => {
    it("leaves ordinary text alone", () => {
        for (const value of ["", "plain", "Acme Corp", "vscode/1.99.0/copilot-chat/0.26.0", "—", "日本語-é-🚀", "a\\b"]) {
            assert.equal(cell(value), value);
        }
    });

    it("escapes every pipe", () => {
        assert.equal(cell("a|b"), "a\\|b");
        assert.equal(cell("|a||b|"), "\\|a\\|\\|b\\|");
    });

    it("turns line breaks into a space (a CR LF pair or a run of breaks is one space)", () => {
        assert.equal(cell("a\nb"), "a b");
        assert.equal(cell("a\rb"), "a b");
        assert.equal(cell("a\r\nb"), "a b");
        assert.equal(cell("a\n\nb"), "a b");
        assert.equal(cell("\nlead"), " lead");
    });

    it("handles both together", () => {
        assert.equal(cell("jetbrains|evil\nname"), "jetbrains\\|evil name");
    });
});

for (const { label, options } of ERAS) {
    describe(`table cells survive hostile strings [${label}]`, () => {
        let server;
        before(async () => {
            server = await startServer({ options, scenario: "escaping" });
        });
        after(() => server.close());

        it("list_organizations: org description", async () => {
            const { result, text } = await server.call("list_organizations");
            assert.ok(!result.isError, text);
            const lines = tableLines(text);
            assert.equal(lines.length, 4, "header, separator and two rows: no row was split by a newline");
            for (const line of lines) assert.equal(separators(line), 4, `row has the wrong number of columns: ${line}`);
            assert.ok(lines.includes("| 10 | pipe-org | Has a \\| pipe and a newline |"), lines.join("\n"));
            assert.ok(lines.includes("| 11 | plain-org | Plain description |"));
        });

        it("get_copilot_seats: team name, editor name and plan type", async () => {
            const { result, text } = await server.call("get_copilot_seats", { org: "pipe-org" });
            assert.ok(!result.isError, text);
            const lines = tableLines(text);
            assert.equal(lines.length, 3, "header, separator and one row");
            for (const line of lines) assert.equal(separators(line), 9, `row has the wrong number of columns: ${line}`);
            const row = lines[2];
            assert.ok(row.includes("| Dev\\|Ops Team |"), row);
            assert.ok(row.includes("| bus\\|iness |"), row);
            assert.ok(row.includes("| vs\\|code |"), row);
        });

        it("get_copilot_usage_all_orgs: plan type", async () => {
            const { result, text } = await server.call("get_copilot_usage_all_orgs");
            assert.ok(!result.isError, text);
            const lines = tableLines(text);
            assert.equal(lines.length, 4, "header, separator and two rows");
            for (const line of lines) assert.equal(separators(line), 8, `row has the wrong number of columns: ${line}`);
            assert.ok(lines.includes("| pipe-org | bus\\|iness | 4 | 1 | 3 | 0 | 0 |"), lines.join("\n"));
        });

        it("JSON mode keeps the raw strings (escaping is a Markdown concern)", async () => {
            const orgs = await server.call("list_organizations", { response_format: "json" });
            assert.equal(orgs.result.structuredContent.organizations[0].description, "Has a | pipe\nand a newline");

            const seats = await server.call("get_copilot_seats", { org: "pipe-org", response_format: "json" });
            const [dave] = seats.result.structuredContent.seats;
            assert.equal(dave.team, "Dev|Ops\nTeam");
            assert.equal(dave.last_activity_editor, "vs|code");
            assert.equal(dave.plan_type, "bus|iness");
        });
    });
}
