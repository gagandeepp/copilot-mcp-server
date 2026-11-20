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

`src/index.ts` — Thin entrypoint (~65 lines) with `#!/usr/bin/env node` shebang. Defines a `createServer()` factory that builds a new `McpServer` and registers all tools, then starts it with `serveStdio(createServer)` from `@modelcontextprotocol/server/stdio`. `createServer()` registers the tools, then the resources, then the prompts (in that order, so lists are deterministic), and sets `ServerOptions.cacheHints` for `tools/list`, `prompts/list`, `resources/list` and `resources/templates/list` (per-resource `cacheHint`s cover `resources/read`).

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

Every tool declares a `title`, read-only `annotations` (`readOnlyHint`, `idempotentHint`, `openWorldHint: true`, `destructiveHint: false`) and a strict `inputSchema` (`z.strictObject`) that includes `response_format` (the two tools without other arguments take only that). No tool declares an `outputSchema`, because the output shape depends on `response_format`. `result.ts` holds `formatResult()` (Markdown text, or JSON text plus `structuredContent`), `errorResult()` (`isError` text, in both formats) and `withResourceLink()`, which the billing and metrics tools wrap around a successful result to add a `resource_link` block (after the unchanged first block) pointing at the matching resource.

Tools:
- `list-organizations.ts` — Lists all accessible GitHub orgs
- `get-copilot-billing-summary.ts` — Billing/seat breakdown for an org
- `get-copilot-seats.ts` — Individual seat assignments (paginated)
- `get-copilot-metrics.ts` — Usage metrics from GitHub's usage-metrics reports API (latest 28-day report, or one `day`), summarised with IDE/feature/language/model breakdowns
- `get-copilot-usage-all-orgs.ts` — Consolidated summary across all orgs

### Resource Modules (`src/resources/`)

Resources expose the same data objects as the tools' JSON mode, one `register*` function per file: `organizations.ts` (static `copilot://orgs`), `billing.ts`, `metrics-28-day.ts` (templates whose `list` callback lists one resource per org) and `metrics-daily.ts` (template with `list: undefined`). All are `mimeType: "application/json"`, carry a per-resource `cacheHint` (`cacheScope: "private"`, since they depend on the token) and call the `fetch*` function with `ctx.mcpReq.signal`:

```typescript
server.registerResource("copilot_billing", new ResourceTemplate(BILLING_TEMPLATE, { list, complete: { org: completeOrg } }), { title, description, mimeType: JSON_MIME, cacheHint }, async (uri, variables, ctx) => {
    const org = orgFromUri(variables.org);          // validate first: bad input is InvalidParams
    try {
        return jsonContents(uri, await fetchBilling(org, getToken(), ctx.mcpReq.signal));
    } catch (err) {
        throw resourceError(err, uri);              // 404 -> ResourceNotFoundError, anything else -> InternalError
    }
});
```

`resources/read.ts` holds the shared pieces: `jsonText()`/`jsonContents()` (the JSON text, identical for resources and prompt embeds), `resourceError()`, and `orgFromUri()`/`dayFromUri()` (validation of the raw URI variables; `ProtocolErrorCode.InvalidParams` without `data`). A resource callback has no `isError` channel, so failures are JSON-RPC errors carrying the same recovery-oriented message as the tools: an `ApiError` 404 becomes `ResourceNotFoundError(uri, message)` (the SDK answers -32602 with `data: { uri }` on both protocol eras; it never emits -32002), anything else (no token, 401/403/429/5xx, timeout, empty report) becomes `ProtocolError(InternalError)`. The metrics resources use `metricsErrorMessage()`. A missing report stays normal content (`available: false`).

`src/resource-uris.ts` is the one place for the URI templates, URI builders and display names (`billingRef(org)`, `metrics28DayRef(org)`, `metricsDailyRef(org, day)`: `{ uri, name }`), shared by the resources, the tools' `resource_link` blocks and the prompts.

`src/org-completion.ts` — `listOrgLogins(signal?)` keeps the `/user/orgs` login list in a module-level cache for 5 minutes (via `fetchOrganizations`; failures are not cached) and `completeOrg(value)` filters it by case-insensitive prefix, at most 100. Both are best-effort and never throw: no token or any API error gives `[]`. The resource templates' `list` callbacks and `complete.org`, and the prompts' `org` completion, all use it (one shared fetch). A throwing `list` callback would fail the whole `resources/list`, hence the empty list.

### Prompt Modules (`src/prompts/`)

Four prompts, one `register*` file each (`inactive-seats-review.ts`, `adoption-report.ts`, `org-comparison.ts`, `billing-forecast.ts`), all `copilot_*` and returning only `user` messages. Arguments are a `z.strictObject` of strings (MCP prompt arguments are strings): digits-only ones use a regex plus `.default(...)`, and every `org` is `completable(orgLogin.describe(...), completeOrg)` (always wrap a fresh `orgLogin.describe(...)`: `completable()` mutates the schema it is given, so wrapping the shared `orgLogin` twice throws). Where the data exists as a resource the prompt embeds it with `embedResource()` from `embed.ts` (one `resource` content block per resource, then the instructions as a final text message). `embedResource()` catches any failure, including a missing token, and returns a text note that names the tool to call instead, so `prompts/get` never fails because of GitHub; only argument validation fails the call. Data that is only a tool (seats, all-orgs) is not embedded: the instructions tell the model which tool to call.

### Data Modules (`src/data/`)

One module per domain: `organizations.ts`, `billing.ts`, `seats.ts`, `metrics.ts`, `usage.ts`. Each exports `fetchX(args..., token, signal)`, which returns a plain typed object (the shape `response_format: "json"` returns; documented in README), and `renderXMarkdown(data)`, which renders that object as Markdown. Tools, resources and prompts share them. Data objects hold raw values (snake_case, `null` for missing); presentation (dashes, "Never", top-10 truncation, Markdown escaping) belongs in the renderer. `usage.ts` takes an optional `onProgress` callback so the tool can send progress notifications; `metrics.ts` also owns the metrics-specific error messages. Markdown output is pinned byte for byte by the golden files, so renderer changes need a deliberate golden update.

### Shared Modules

- `github-client.ts` — `getToken()` (reads `GITHUB_TOKEN` env var), `githubFetch<T>()` (single request), `githubFetchAll<T>()` (handles pagination via Link headers), `downloadReport()` (fetches a signed report link as text); all take an optional `AbortSignal`. `githubFetch` and `githubFetchAll` share one internal `request()` helper, which returns `data: null` for a 204 response. Requests send `Accept: application/vnd.github+json`, API version 2022-11-28 and a `copilot-mcp-server/<version>` User-Agent, with a 30 s timeout combined with the caller's signal. The Bearer token is sent only to `https://api.github.com`, never to other origins. `downloadReport()` never takes or sends the token, accepts only `https:` links, shares the 30 s timeout, and rejects files over 25 MB (by `content-length` and while streaming). Failures throw `ApiError` (`status`, `rateLimited`) with a recovery-oriented message that never includes the raw response body.
- `metrics-report.ts` — Zod schemas for the usage-metrics report files (28-day wrapper with `day_totals`, or a 1-day record; NDJSON, a JSON array or one object are all accepted, malformed lines are counted and skipped), the `reportLinks` envelope schema, `parseReportFile()` and `buildMetricsSummary()` (aggregates parsed records into the `MetricsSummary` data object; rendering is in `data/metrics.ts`).
- `markdown.ts` — `cell()`: escapes `|` and turns line breaks into a space for user-controlled strings placed in Markdown table cells (org login/description, team, editor, plan type, metrics names).
- `version.ts` — Exports `version`, read once from `package.json`; used for the server info and the User-Agent.
- `schemas.ts` — Shared Zod schemas (`orgLogin`: validated GitHub org login, reused by the org-scoped tools, the resources and the prompts, each adding its own `.describe()`; `responseFormat`: the `markdown` | `json` enum, default `markdown`, used by every tool).
- `types.ts` — TypeScript interfaces for GitHub API responses (`GitHubOrg`, `CopilotBilling`, `CopilotSeatDetail`, `CopilotSeatsResponse`).

### Patterns

- **Parameter validation**: Zod schemas with `.describe()` for MCP tool schema generation
- **Error handling**: try/catch in every tool handler returning `{ content: [...], isError: true }`; resource handlers throw `ProtocolError`s instead (`resourceError()`); prompt handlers turn embed failures into text notes
- **Adding a resource or prompt**: reuse a `fetch*` function from `data/`, build URIs only through `resource-uris.ts`, register it in `createServer()` after the tools, and add it to `test/resources.test.mjs` / `test/prompts.test.mjs`
- **Response format**: Markdown text (tables, summaries) by default; `response_format: "json"` returns the data as `structuredContent` plus the same JSON as text. Errors are `isError` text in both modes
- **No circular dependencies**: Tools depend on `data/`, `schemas.ts`, `github-client.ts`, `resource-uris.ts` and `tools/result.ts`; resources depend on `data/`, `schemas.ts`, `github-client.ts`, `resource-uris.ts`, `org-completion.ts` and `resources/read.ts`; prompts depend on the same plus `resources/read.ts` and `prompts/embed.ts`; `data/` depends on `github-client.ts`, `markdown.ts`, `metrics-report.ts` and `types.ts`; nothing depends on tools, resources or prompts except `index.ts`

## Tests

Node's built-in runner (`node:test` + `node:assert/strict`), ESM `.mjs` files in `test/`, run against the built server in `dist/`. Test files are `test/*.test.mjs` (the `test` script lists them with a glob, because `node --test test/` fails on current Node and a bare `node --test` would also run the helpers).

- `test/helpers/fetch-mock.mjs` — a scenario-driven mock of GitHub (API and the signed report-download host), preloaded into the server with `node --import`; `MOCK_SCENARIO` picks the `/user/orgs` list (`basic`, `classify`, `clean`, `escaping`, `none`, `many` with 120 orgs, `mixedcase`, `flaky` whose first call fails), everything else is keyed by org login (`both` succeeds on billing and 28-day metrics, `forbidden` is a 403 on both). `MOCK_STATS` is where it writes a request log, `MOCK_TIMEOUT_MS` shrinks the 30 s request timeout.
- `test/helpers/harness.mjs` — `startServer()` spawns the server with the mock, a fake `GITHUB_TOKEN` (or none) and an empty temp working directory (so a repo `.env` cannot leak in), and connects a real `@modelcontextprotocol/client`; `ERAS` lists the two protocol eras, and every protocol-level test runs in both. `MCP_TEST_ENTRY` points the suite at another build.
- `test/helpers/golden-cases.mjs` — the calls whose Markdown is pinned in `test/fixtures/golden/<name>.md`.
- Test files: `client` (github-client unit tests), `protocol` (eras, tools/list, validation), `stdio` (raw JSON-RPC-only stdout), `all-orgs` (all-orgs summary, seats, cancellation), `metrics`, `golden`, `json` (`response_format: "json"` shapes), `markdown` (`cell()` escaping), `resources` (list/templates/read, validation, errors, cache hints, `{org}` completion, the tools' `resource_link` blocks), `prompts` (list, `prompts/get` with embeds and failure notes, argument validation, `org` completion). The 2026-07-28 client keeps a response cache, so tests that count requests read with `{ cacheMode: "bypass" }`.
- `test/fixtures/` — docs-derived usage-metrics report fixtures (`derived/` is built from the documented example, see `SOURCES.txt`) and the golden files.
- `scripts/smoke.mjs` — the live smoke test (`npm run smoke`), not part of `npm test`.

## Environment

Requires `GITHUB_TOKEN` env var with `manage_billing:copilot` and `read:org` scopes. `get_copilot_metrics` additionally needs an organization owner (or the "View Organization Copilot Metrics" permission) and the org's "Copilot usage metrics" policy enabled. Set in `.env` file (gitignored).
