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
//
// Exit codes: 0 all good, 1 a real failure, 2 not run (no token or no build).
import "dotenv/config";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/client/stdio";

const EXPECTED_TOOLS = [
    "get_copilot_billing_summary",
    "get_copilot_metrics",
    "get_copilot_seats",
    "get_copilot_usage_all_orgs",
    "list_organizations",
];

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

/** Call a tool whose failure with HTTP 403/404 is an expected outcome for a token that is not an org owner. */
async function callAllowingDenied(client, label, name, args) {
    const result = await client.callTool({ name, arguments: args });
    const text = result.content?.[0]?.text ?? "";
    if (!result.isError) {
        report(true, label, firstLine(text));
    } else if (/HTTP (403|404)\b/.test(text) && !/rate limit/i.test(text)) {
        // A rate-limited 403 is not a permissions outcome: it falls through to a failure below.
        console.log(`INFO  ${label}  reported, not a failure: ${firstLine(text)}`);
    } else {
        report(false, label, firstLine(text));
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
