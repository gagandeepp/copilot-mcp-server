// Raw stdio checks, no SDK client in between: an MCP stdio server's stdout carries JSON-RPC and nothing else.
// A stray console.log (from the server or a dependency such as dotenv) would corrupt the stream.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { getDefaultEnvironment } from "@modelcontextprotocol/client/stdio";
import { MOCK, TOKEN, defaultEntry } from "./helpers/harness.mjs";

const REQUESTS = [
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "stdio-test", version: "0" } } },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
];

/** Run the server in `cwd`, optionally send messages, wait for the response with `waitForId`, then close stdin and wait for exit. */
async function session({ cwd, messages = [], waitForId }) {
    const child = spawn(process.execPath, ["--import", MOCK, defaultEntry()], {
        cwd,
        env: { ...getDefaultEnvironment(), GITHUB_TOKEN: TOKEN },
        stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const listeners = new Set();
    child.stdout.on("data", (chunk) => {
        stdout += chunk;
        for (const listener of listeners) listener();
    });
    child.stderr.on("data", (chunk) => {
        stderr += chunk;
    });
    const exited = new Promise((resolve) => child.on("exit", (code) => resolve(code)));
    const killTimer = setTimeout(() => child.kill("SIGKILL"), 15_000);

    try {
        for (const message of messages) child.stdin.write(JSON.stringify(message) + "\n");
        if (waitForId !== undefined) {
            await new Promise((resolve, reject) => {
                const answered = (line) => {
                    try {
                        const message = JSON.parse(line);
                        return message.id === waitForId && "result" in message;
                    } catch {
                        return false; // a partial line; more data is coming
                    }
                };
                const check = () => {
                    if (stdout.split("\n").some(answered)) {
                        listeners.delete(check);
                        resolve();
                    }
                };
                listeners.add(check);
                child.on("exit", () => reject(new Error(`server exited before answering id ${waitForId}\n${stderr}`)));
                check();
            });
        }
        child.stdin.end();
        const code = await exited;
        return { stdout, stderr, code };
    } finally {
        clearTimeout(killTimer);
        child.kill();
    }
}

const jsonLines = (stdout) => stdout.split("\n").filter((line) => line.trim() !== "");

function assertPureJsonRpc(stdout) {
    const lines = jsonLines(stdout);
    assert.ok(lines.length > 0);
    for (const line of lines) {
        let message;
        assert.doesNotThrow(() => (message = JSON.parse(line)), `stdout line is not JSON: ${line.slice(0, 80)}`);
        assert.equal(message.jsonrpc, "2.0", `stdout line is not JSON-RPC: ${line.slice(0, 80)}`);
    }
    return lines.map((line) => JSON.parse(line));
}

describe("stdio purity", () => {
    it("answers a raw 2025-11-25 initialize + tools/list with only JSON-RPC on stdout", async () => {
        const cwd = mkdtempSync(path.join(os.tmpdir(), "copilot-mcp-stdio-"));
        try {
            const { stdout, stderr } = await session({ cwd, messages: REQUESTS, waitForId: 2 });
            const messages = assertPureJsonRpc(stdout);

            const init = messages.find((m) => m.id === 1).result;
            assert.equal(init.protocolVersion, "2025-11-25");
            assert.equal(init.serverInfo.name, "github-copilot-usage");
            const tools = messages.find((m) => m.id === 2).result.tools;
            assert.deepEqual(tools.map((t) => t.name).sort(), [
                "get_copilot_billing_summary", "get_copilot_metrics", "get_copilot_seats", "get_copilot_usage_all_orgs", "list_organizations",
            ]);
            assert.match(stderr, /running on stdio/, "the startup banner goes to stderr");
        } finally {
            rmSync(cwd, { recursive: true, force: true });
        }
    });

    it("keeps stdout JSON-RPC-only when a .env file sits in the working directory", async () => {
        const cwd = mkdtempSync(path.join(os.tmpdir(), "copilot-mcp-stdio-env-"));
        try {
            writeFileSync(path.join(cwd, ".env"), "SOME_SETTING=1\n");
            const { stdout } = await session({ cwd, messages: REQUESTS, waitForId: 2 });
            assertPureJsonRpc(stdout);
        } finally {
            rmSync(cwd, { recursive: true, force: true });
        }
    });

    it("prints nothing to stdout when stdin is closed without any request", async () => {
        const cwd = mkdtempSync(path.join(os.tmpdir(), "copilot-mcp-stdio-eof-"));
        try {
            const { stdout, stderr } = await session({ cwd });
            assert.equal(stdout.length, 0, `unexpected stdout: ${stdout.slice(0, 200)}`);
            assert.match(stderr, /running on stdio/);
        } finally {
            rmSync(cwd, { recursive: true, force: true });
        }
    });
});
