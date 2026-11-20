// Markdown output of every tool is pinned byte for byte against goldens captured from the server before the
// data/render refactor (see helpers/golden-cases.mjs, which also records the one intended exception: the escaped
// pipe in the metrics "jetbrains|evil name" row). Runs in both protocol eras and with response_format omitted
// and given explicitly ("markdown" is the default).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { ERAS, FIXTURES, startServer } from "./helpers/harness.mjs";
import { GOLDEN_CASES } from "./helpers/golden-cases.mjs";

const scenarios = [...new Set(GOLDEN_CASES.map((c) => c.scenario))];
// A successful billing or metrics result has a second block, a resource_link; the first block is the pinned Markdown.
const LINKED_TOOLS = new Set(["get_copilot_billing_summary", "get_copilot_metrics"]);

for (const { label, options } of ERAS) {
    describe(`golden Markdown [${label}]`, () => {
        const servers = new Map();
        before(async () => {
            for (const scenario of scenarios) servers.set(scenario, await startServer({ options, scenario }));
        });
        after(async () => {
            await Promise.all([...servers.values()].map((s) => s.close()));
        });

        for (const c of GOLDEN_CASES) {
            const file = path.join(FIXTURES, "golden", `${c.name}.md`);
            it(c.name, async () => {
                const golden = readFileSync(file, "utf8");
                for (const args of [c.args, { ...c.args, response_format: "markdown" }]) {
                    const { result, text } = await servers.get(c.scenario).call(c.tool, args);
                    assert.equal(Boolean(result.isError), Boolean(c.isError), text);
                    assert.equal(result.content.length, LINKED_TOOLS.has(c.tool) && !c.isError ? 2 : 1);
                    if (result.content.length === 2) assert.equal(result.content[1].type, "resource_link");
                    assert.equal(result.structuredContent, undefined, "Markdown mode returns no structuredContent");
                    assert.equal(text, golden);
                }
            });
        }
    });
}
