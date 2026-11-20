// Shared helpers: spawn the BUILT server (dist/index.js) with the fetch mock preloaded and connect a real v2 client.
// Nothing here touches the network or needs a real GitHub token.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/client/stdio";

const here = path.dirname(fileURLToPath(import.meta.url));

export const REPO = path.resolve(here, "../..");
export const MOCK = path.join(here, "fetch-mock.mjs");
export const FIXTURES = path.join(REPO, "test/fixtures");
export const TOKEN = "test-token-123";

/** The server entry under test. MCP_TEST_ENTRY lets the same suite run against another build (for example a checkout of an older commit). */
export const defaultEntry = () => process.env.MCP_TEST_ENTRY ?? path.join(REPO, "dist/index.js");

/** The two protocol eras a client can speak; every protocol-level test runs in both. */
export const ERAS = [
    { label: "2026-07-28", era: "modern", options: { versionNegotiation: { mode: { pin: "2026-07-28" } } } },
    { label: "legacy 2025-11-25", era: "legacy", options: {} },
];

/**
 * Start the server and connect a client.
 *
 * - The fetch mock is always preloaded, so even a "no token" server can never reach GitHub.
 * - The server runs in an empty temp directory, so a developer's repo `.env` cannot leak a real token into it.
 * - Each server gets its own stats file (test files run in parallel processes).
 *
 * @param {object} [opts]
 * @param {object} [opts.options]        Client options (see ERAS).
 * @param {string} [opts.scenario]       Mock scenario for /user/orgs (basic, classify, clean, escaping, none, many, mixedcase).
 * @param {string | null} [opts.token]   GITHUB_TOKEN for the server; null leaves it unset.
 * @param {number} [opts.mockTimeoutMs]  Shrink the 30 s request timeout inside the server process.
 * @param {string} [opts.entry]          Server entry file.
 */
export async function startServer({ options = {}, scenario = "basic", token = TOKEN, mockTimeoutMs, entry = defaultEntry() } = {}) {
    const dir = mkdtempSync(path.join(os.tmpdir(), "copilot-mcp-test-"));
    const statsFile = path.join(dir, "stats.json");
    const env = { ...getDefaultEnvironment(), MOCK_STATS: statsFile, MOCK_SCENARIO: scenario };
    if (token !== null) env.GITHUB_TOKEN = token;
    if (mockTimeoutMs !== undefined) env.MOCK_TIMEOUT_MS = String(mockTimeoutMs);

    const transport = new StdioClientTransport({
        command: process.execPath,
        args: ["--import", MOCK, entry],
        env,
        cwd: dir,
        stderr: "pipe",
    });
    let stderr = "";
    transport.stderr?.on("data", (chunk) => {
        stderr += chunk;
    });

    const client = new Client({ name: "copilot-mcp-tests", version: "1.0.0" }, options);
    try {
        await client.connect(transport);
    } catch (err) {
        rmSync(dir, { recursive: true, force: true });
        throw new Error(`server failed to start: ${err.message}\n${stderr}`);
    }

    return {
        client,
        /** Server stderr so far (diagnostics only). */
        stderr: () => stderr,
        /** What the mock saw: requests, maxInflight, aborted, bigStreamPulled. */
        stats() {
            try {
                return JSON.parse(readFileSync(statsFile, "utf8"));
            } catch {
                return { requests: [], maxInflight: 0, aborted: [], bigStreamPulled: 0 };
            }
        },
        /** Call a tool; returns the raw result plus its first text block. */
        async call(name, args = {}, requestOptions) {
            const result = await client.callTool({ name, arguments: args }, requestOptions);
            return { result, text: result.content?.[0]?.text ?? "" };
        },
        async close() {
            try {
                await client.close();
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        },
    };
}

/** Requests the mock saw that went to api.github.com / to the signed download host. */
export const apiRequests = (requests) => requests.filter((r) => r.host === "api.github.com");
export const downloadRequests = (requests) => requests.filter((r) => r.host !== "api.github.com");
