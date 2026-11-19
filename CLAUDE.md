# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

An MCP (Model Context Protocol) server that exposes GitHub Copilot management tools — billing, seats, metrics, and usage across organizations. Communicates over stdio using `@modelcontextprotocol/server` (MCP TypeScript SDK v2), serving both the 2026-07-28 protocol revision and 2025-era clients.

## Commands

```bash
npm run build          # TypeScript compilation (tsc)
npm run dev            # Watch mode for development (tsc --watch)
npm run start          # Run the MCP server (node dist/index.js)
npm test               # Build, then run the test suite (node --test test/*.test.mjs); no network or token needed
npm run smoke          # Live smoke test against the real GitHub API (needs GITHUB_TOKEN; run after `npm run build`)
```

`dist/` is committed (installing from a git URL relies on it), so it must be rebuilt (`npm run build`) before committing; `npm test` does this too. tsc never deletes outputs, so after removing or renaming a source file, delete `dist/` and rebuild.

## Architecture

**ES Module project** (`"type": "module"`) targeting ES2022 with Node16 module resolution.

### Entry Point

`src/index.ts` — Thin entrypoint (~40 lines) with `#!/usr/bin/env node` shebang. Defines a `createServer()` factory that builds a new `McpServer` and registers all tools, then starts it with `serveStdio(createServer)` from `@modelcontextprotocol/server/stdio`.

### Tool Modules (`src/tools/`)

Each tool is a standalone file exporting a single `register*` function. Tools are thin: validate the input, call a `fetch*` function from `src/data/`, and return the result in the requested `response_format`:

```typescript
export function registerToolName(server: McpServer): void {
  server.registerTool("tool_name", { title, description, annotations, inputSchema }, async (args, ctx) => {
    try {
      const data = await fetchX(args..., getToken(), ctx.mcpReq.signal);
      return formatResult(data, args.response_format, renderXMarkdown);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  });
}
```

Every tool declares a `title`, read-only `annotations` (`readOnlyHint`, `idempotentHint`, `openWorldHint: true`, `destructiveHint: false`) and a strict `inputSchema` (`z.strictObject`) that includes `response_format` (the two tools without other arguments take only that). No tool declares an `outputSchema`, because the output shape depends on `response_format`. `result.ts` holds `formatResult()` (Markdown text, or JSON text plus `structuredContent`) and `errorResult()` (`isError` text, in both formats).

Tools:
- `list-organizations.ts` — Lists all accessible GitHub orgs
- `get-copilot-billing-summary.ts` — Billing/seat breakdown for an org
- `get-copilot-seats.ts` — Individual seat assignments (paginated)
- `get-copilot-metrics.ts` — Usage metrics from GitHub's usage-metrics reports API (latest 28-day report, or one `day`), summarised with IDE/feature/language/model breakdowns
- `get-copilot-usage-all-orgs.ts` — Consolidated summary across all orgs

### Data Modules (`src/data/`)

One module per domain: `organizations.ts`, `billing.ts`, `seats.ts`, `metrics.ts`, `usage.ts`. Each exports `fetchX(args..., token, signal)`, which returns a plain typed object (the shape `response_format: "json"` returns; documented in README), and `renderXMarkdown(data)`, which renders that object as Markdown. Tools and any future MCP resources share them. Data objects hold raw values (snake_case, `null` for missing); presentation (dashes, "Never", top-10 truncation, Markdown escaping) belongs in the renderer. `usage.ts` takes an optional `onProgress` callback so the tool can send progress notifications; `metrics.ts` also owns the metrics-specific error messages. Markdown output is pinned byte for byte by the golden files, so renderer changes need a deliberate golden update.

### Shared Modules

- `github-client.ts` — `getToken()` (reads `GITHUB_TOKEN` env var), `githubFetch<T>()` (single request), `githubFetchAll<T>()` (handles pagination via Link headers), `downloadReport()` (fetches a signed report link as text); all take an optional `AbortSignal`. `githubFetch` and `githubFetchAll` share one internal `request()` helper, which returns `data: null` for a 204 response. Requests send `Accept: application/vnd.github+json`, API version 2022-11-28 and a `copilot-mcp-server/<version>` User-Agent, with a 30 s timeout combined with the caller's signal. The Bearer token is sent only to `https://api.github.com`, never to other origins. `downloadReport()` never takes or sends the token, accepts only `https:` links, shares the 30 s timeout, and rejects files over 25 MB (by `content-length` and while streaming). Failures throw `ApiError` (`status`, `rateLimited`) with a recovery-oriented message that never includes the raw response body.
- `metrics-report.ts` — Zod schemas for the usage-metrics report files (28-day wrapper with `day_totals`, or a 1-day record; NDJSON, a JSON array or one object are all accepted, malformed lines are counted and skipped), the `reportLinks` envelope schema, `parseReportFile()` and `buildMetricsSummary()` (aggregates parsed records into the `MetricsSummary` data object; rendering is in `data/metrics.ts`).
- `markdown.ts` — `cell()`: escapes `|` and turns line breaks into a space for user-controlled strings placed in Markdown table cells (org login/description, team, editor, plan type, metrics names).
- `version.ts` — Exports `version`, read once from `package.json`; used for the server info and the User-Agent.
- `schemas.ts` — Shared Zod schemas (`orgLogin`: validated GitHub org login, reused by the org-scoped tools, each adding its own `.describe()`; `responseFormat`: the `markdown` | `json` enum, default `markdown`, used by every tool).
- `types.ts` — TypeScript interfaces for GitHub API responses (`GitHubOrg`, `CopilotBilling`, `CopilotSeatDetail`, `CopilotSeatsResponse`).

### Patterns

- **Parameter validation**: Zod schemas with `.describe()` for MCP tool schema generation
- **Error handling**: try/catch in every handler returning `{ content: [...], isError: true }`
- **Response format**: Markdown text (tables, summaries) by default; `response_format: "json"` returns the data as `structuredContent` plus the same JSON as text. Errors are `isError` text in both modes
- **No circular dependencies**: Tools depend on `data/`, `schemas.ts`, `github-client.ts` and `tools/result.ts`; `data/` depends on `github-client.ts`, `markdown.ts`, `metrics-report.ts` and `types.ts`; nothing depends on tools except `index.ts`

## Tests

Node's built-in runner (`node:test` + `node:assert/strict`), ESM `.mjs` files in `test/`, run against the built server in `dist/`. Test files are `test/*.test.mjs` (the `test` script lists them with a glob, because `node --test test/` fails on current Node and a bare `node --test` would also run the helpers).

- `test/helpers/fetch-mock.mjs` — a scenario-driven mock of GitHub (API and the signed report-download host), preloaded into the server with `node --import`; `MOCK_SCENARIO` picks the `/user/orgs` list, everything else is keyed by org login. `MOCK_STATS` is where it writes a request log, `MOCK_TIMEOUT_MS` shrinks the 30 s request timeout.
- `test/helpers/harness.mjs` — `startServer()` spawns the server with the mock, a fake `GITHUB_TOKEN` (or none) and an empty temp working directory (so a repo `.env` cannot leak in), and connects a real `@modelcontextprotocol/client`; `ERAS` lists the two protocol eras, and every protocol-level test runs in both. `MCP_TEST_ENTRY` points the suite at another build.
- `test/helpers/golden-cases.mjs` — the calls whose Markdown is pinned in `test/fixtures/golden/<name>.md`.
- Test files: `client` (github-client unit tests), `protocol` (eras, tools/list, validation), `stdio` (raw JSON-RPC-only stdout), `all-orgs` (all-orgs summary, seats, cancellation), `metrics`, `golden`, `json` (`response_format: "json"` shapes), `markdown` (`cell()` escaping).
- `test/fixtures/` — docs-derived usage-metrics report fixtures (`derived/` is built from the documented example, see `SOURCES.txt`) and the golden files.
- `scripts/smoke.mjs` — the live smoke test (`npm run smoke`), not part of `npm test`.

## Environment

Requires `GITHUB_TOKEN` env var with `manage_billing:copilot` and `read:org` scopes. `get_copilot_metrics` additionally needs an organization owner (or the "View Organization Copilot Metrics" permission) and the org's "Copilot usage metrics" policy enabled. Set in `.env` file (gitignored).
