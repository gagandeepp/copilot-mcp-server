#!/usr/bin/env node
// Live smoke test: starts the built server (dist/index.js) and exercises it against the REAL GitHub API.
// Needs a real GITHUB_TOKEN (environment or .env) and a built dist/ (`npm run build`). Run with `npm run smoke`.
//
// What it checks:
//   - the server connects on protocol 2026-07-28 and lists 5 tools
//   - list_organizations succeeds
//   - for the first organization it calls billing, seats and metrics and PRINTS each outcome. HTTP 403/404 are
//     reported but are not failures: the token may belong to someone who is not an organization owner.
//   - invalid input (get_copilot_seats with page: 0) comes back as an error result
//   - resources: resources/list has copilot://orgs plus one billing entry per org, the 3 templates are listed, reads
//     match the tools' JSON, an org that does not exist is "resource not found" (-32602), and lists and reads carry
//     cache hints (ttlMs > 0; private, except the static template and prompt lists, which are public)
//   - prompts: 4 are listed, copilot_adoption_report embeds a resource, and `org` completion returns real logins.
//     As above, an embed or read that fails with HTTP 403/404 for the first organization is reported, not a failure.
//
// Exit codes: 0 all good, 1 a real failure, 2 not run (no token or no build).
import "dotenv/config";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client, ResourceNotFoundError } from "@modelcontextprotocol/client";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/client/stdio";

const EXPECTED_TOOLS = [
    "get_copilot_billing_summary",
    "get_copilot_metrics",
    "get_copilot_seats",
    "get_copilot_usage_all_orgs",
    "list_organizations",
];
const EXPECTED_TEMPLATES = [
    "copilot://orgs/{org}/billing",
    "copilot://orgs/{org}/metrics/28-day",
    "copilot://orgs/{org}/metrics/daily/{day}",
];
const EXPECTED_PROMPTS = [
    "copilot_adoption_report",
    "copilot_billing_forecast",
    "copilot_inactive_seats_review",
    "copilot_org_comparison",
];
// The client keeps a response cache on 2026-07-28; bypass it so every check sees the server's own answer.
const bypass = { cacheMode: "bypass" };

const entry = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist/index.js");
const token = process.env.GITHUB_TOKEN;

if (!token) {
    console.error(
        "GITHUB_TOKEN is not set. The smoke test talks to the real GitHub API and needs a token with the\n" +
            "manage_billing:copilot and read:org scopes. Export GITHUB_TOKEN (or put it in .env) and run `npm run smoke` again."
    );
    process.exit(2);
}
if (!existsSync(entry)) {
    console.error(`${entry} does not exist. Run \`npm run build\` first.`);
    process.exit(2);
}

const failures = [];
const report = (ok, label, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
    if (!ok) failures.push(label);
};
const firstLine = (text) => text.split("\n").find((line) => line.trim() !== "") ?? "";
const errorText = (err) => (err instanceof Error ? err.message : String(err));
// A rate-limited 403 is not a permissions outcome, so it does not count as denied.
const isDenied = (text) => /HTTP (403|404)\b/.test(text) && !/rate limit/i.test(text);
const info = (label, detail) => console.log(`INFO  ${label}  reported, not a failure: ${detail}`);
const cacheHint = (result) => `ttlMs ${result.ttlMs}, ${result.cacheScope}`;
const hasCacheHint = (result, scope) => typeof result.ttlMs === "number" && result.ttlMs > 0 && result.cacheScope === scope;
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Call a tool whose failure with HTTP 403/404 is an expected outcome for a token that is not an org owner. */
async function callAllowingDenied(client, label, name, args) {
    const result = await client.callTool({ name, arguments: args });
    const text = result.content?.[0]?.text ?? "";
    if (!result.isError) {
        report(true, label, firstLine(text));
    } else if (isDenied(text)) {
        info(label, firstLine(text));
    } else {
        report(false, label, firstLine(text));
    }
}

/** Resources: lists, reads (compared with the tools' JSON), not-found and cache hints. */
async function checkResources(client, orgsResult, org) {
    const list = await client.listResources(undefined, bypass);
    const uris = list.resources.map((r) => r.uri);
    const orgs = orgsResult.structuredContent?.organizations ?? [];
    const missing = ["copilot://orgs", ...orgs.map((o) => `copilot://orgs/${o.login}/billing`)].filter((u) => !uris.includes(u));
    report(missing.length === 0, "resources/list has copilot://orgs and one billing entry per org", missing.length ? `missing ${missing.join(", ")}` : `${uris.length} resource(s)`);
    report(hasCacheHint(list, "private"), "resources/list carries a private cache hint", cacheHint(list));

    const templates = await client.listResourceTemplates(undefined, bypass);
    const templateUris = templates.resourceTemplates.map((t) => t.uriTemplate).sort();
    report(sameJson(templateUris, EXPECTED_TEMPLATES), "resources/templates/list shows 3 templates", templateUris.join(", "));
    report(hasCacheHint(templates, "public"), "resources/templates/list carries a public cache hint", cacheHint(templates));

    const orgsRead = await client.readResource({ uri: "copilot://orgs" }, bypass);
    report(sameJson(JSON.parse(orgsRead.contents[0].text), orgsResult.structuredContent), "resources/read copilot://orgs matches list_organizations");
    report(hasCacheHint(orgsRead, "private"), "copilot://orgs read carries a private cache hint", cacheHint(orgsRead));

    if (org) {
        const uri = `copilot://orgs/${org}/billing`;
        const tool = await client.callTool({ name: "get_copilot_billing_summary", arguments: { org, response_format: "json" } });
        const toolText = tool.content?.[0]?.text ?? "";
        try {
            const read = await client.readResource({ uri }, bypass);
            report(!tool.isError && sameJson(JSON.parse(read.contents[0].text), tool.structuredContent), `resources/read ${uri} matches get_copilot_billing_summary`, tool.isError ? `the tool failed: ${firstLine(toolText)}` : "");
            report(hasCacheHint(read, "private"), "billing read carries a private cache hint", cacheHint(read));
        } catch (err) {
            // A token that is not an org owner is denied on both paths; anything else is a real failure.
            if (tool.isError && isDenied(toolText) && isDenied(errorText(err))) info(`resources/read ${uri}`, firstLine(errorText(err)));
            else report(false, `resources/read ${uri}`, firstLine(errorText(err)));
        }
    }

    // A syntactically valid login that no organization uses: GitHub answers 404, the server "resource not found".
    const nobody = `copilot-mcp-smoke-${Date.now().toString(36)}`;
    const nobodyUri = `copilot://orgs/${nobody}/billing`;
    try {
        await client.readResource({ uri: nobodyUri }, bypass);
        report(false, "reading a nonexistent org is resource not found (-32602)", `${nobodyUri} was read without an error`);
    } catch (err) {
        const ok = ResourceNotFoundError.isInstance(err) && err.code === -32602 && err.data?.uri === nobodyUri;
        report(ok, "reading a nonexistent org is resource not found (-32602)", `code ${err?.code}: ${firstLine(errorText(err))}`);
    }
}

/** Prompts: the list, an embedded resource in copilot_adoption_report, and `org` completion. */
async function checkPrompts(client, org) {
    const list = await client.listPrompts(undefined, bypass);
    const names = list.prompts.map((p) => p.name).sort();
    report(sameJson(names, EXPECTED_PROMPTS), "prompts/list returns 4 prompts", names.join(", "));
    report(hasCacheHint(list, "public"), "prompts/list carries a public cache hint", cacheHint(list));
    if (!org) return;

    const prompt = await client.getPrompt({ name: "copilot_adoption_report", arguments: { org } });
    const embedded = prompt.messages.filter((m) => m.content.type === "resource").map((m) => m.content.resource.uri);
    const notes = prompt.messages.filter((m) => m.content.type === "text" && m.content.text.startsWith("Note:")).map((m) => m.content.text);
    if (embedded.length > 0) {
        report(true, "prompts/get copilot_adoption_report embeds a resource", embedded.join(", "));
    } else if (notes.length > 0 && notes.every(isDenied)) {
        info("prompts/get copilot_adoption_report", "no resource could be embedded (HTTP 403/404), so it carries notes instead");
    } else {
        report(false, "prompts/get copilot_adoption_report embeds a resource", firstLine(notes[0] ?? "no resource and no note"));
    }

    // Complete on the first letter: the org list is in GitHub's order, so `org` is always within the first 100 matches.
    const prefix = org.slice(0, 1);
    const refs = [
        ["prompt copilot_adoption_report", { type: "ref/prompt", name: "copilot_adoption_report" }],
        ["template copilot://orgs/{org}/billing", { type: "ref/resource", uri: "copilot://orgs/{org}/billing" }],
    ];
    for (const [label, ref] of refs) {
        const { completion } = await client.complete({ ref, argument: { name: "org", value: prefix } });
        report(completion.values.includes(org), `completion/complete for org (${label}) returns real logins`, `"${prefix}" -> ${completion.values.length} login(s)`);
    }
}

const client = new Client(
    { name: "copilot-mcp-smoke", version: "1.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } }
);
const transport = new StdioClientTransport({
    command: process.execPath,
    args: [entry],
    env: { ...getDefaultEnvironment(), GITHUB_TOKEN: token },
    stderr: "pipe",
});
let serverStderr = "";
transport.stderr?.on("data", (chunk) => {
    serverStderr += chunk;
});

try {
    await client.connect(transport);
    const info = client.getServerVersion();
    report(client.getProtocolEra() === "modern", "connected on protocol 2026-07-28", `${info?.name} ${info?.version}`);

    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    report(
        tools.length === 5 && JSON.stringify(names) === JSON.stringify(EXPECTED_TOOLS),
        "lists 5 tools",
        names.join(", ")
    );

    // list_organizations must succeed.
    const orgsResult = await client.callTool({ name: "list_organizations", arguments: { response_format: "json" } });
    const orgs = orgsResult.structuredContent?.organizations;
    if (orgsResult.isError || !Array.isArray(orgs)) {
        report(false, "list_organizations", firstLine(orgsResult.content?.[0]?.text ?? ""));
    } else {
        report(true, "list_organizations", `${orgs.length} organization(s)`);
    }

    // The first organization: billing, seats and metrics. Print what happened.
    const org = Array.isArray(orgs) ? orgs[0]?.login : undefined;
    if (org) {
        console.log(`\nUsing organization "${org}" for the next calls.`);
        await callAllowingDenied(client, "get_copilot_billing_summary", "get_copilot_billing_summary", { org });
        await callAllowingDenied(client, "get_copilot_seats", "get_copilot_seats", { org, per_page: 5 });
        await callAllowingDenied(client, "get_copilot_metrics", "get_copilot_metrics", { org });
        console.log("");
    } else if (Array.isArray(orgs)) {
        console.log("INFO  the token sees no organizations, so billing, seats and metrics were not called");
    }

    // Invalid input is rejected by the server's schema, as an error result.
    const invalid = await client.callTool({ name: "get_copilot_seats", arguments: { org: org ?? "example", page: 0 } });
    report(invalid.isError === true, "get_copilot_seats with page: 0 is rejected", firstLine(invalid.content?.[0]?.text ?? ""));

    console.log("");
    await checkResources(client, orgsResult, org);
    console.log("");
    await checkPrompts(client, org);
} catch (err) {
    report(false, "smoke run", err instanceof Error ? err.message : String(err));
} finally {
    await client.close().catch(() => {});
}

if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) failed: ${failures.join("; ")}`);
    if (serverStderr.trim()) console.error(`\nServer stderr:\n${serverStderr.trim()}`);
    process.exit(1);
}
console.log("Smoke test passed.");
