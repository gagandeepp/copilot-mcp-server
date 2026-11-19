# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

An MCP (Model Context Protocol) server that exposes GitHub Copilot management tools — billing, seats, metrics, and usage across organizations. Communicates over stdio using `@modelcontextprotocol/server` (MCP TypeScript SDK v2), serving both the 2026-07-28 protocol revision and 2025-era clients.

## Commands

```bash
npm run build          # TypeScript compilation (tsc)
npm run dev            # Watch mode for development (tsc --watch)
npm run start          # Run the MCP server (node dist/index.js)
```

No test framework is currently configured.

## Architecture

**ES Module project** (`"type": "module"`) targeting ES2022 with Node16 module resolution.

### Entry Point

`src/index.ts` — Thin entrypoint (~40 lines) with `#!/usr/bin/env node` shebang. Defines a `createServer()` factory that builds a new `McpServer` and registers all tools, then starts it with `serveStdio(createServer)` from `@modelcontextprotocol/server/stdio`.

### Tool Modules (`src/tools/`)

Each tool is a standalone file exporting a single `register*` function:

```typescript
export function registerToolName(server: McpServer): void {
  server.registerTool("tool_name", { description, inputSchema }, handler);
}
```

Every tool declares a `title` and read-only `annotations` (`readOnlyHint`, `idempotentHint`, `openWorldHint: true`, `destructiveHint: false`).

Tools:
- `list-organizations.ts` — Lists all accessible GitHub orgs
- `get-copilot-billing-summary.ts` — Billing/seat breakdown for an org
- `get-copilot-seats.ts` — Individual seat assignments (paginated)
- `get-copilot-metrics.ts` — Usage metrics from GitHub's usage-metrics reports API (latest 28-day report, or one `day`), summarised with IDE/feature/language/model breakdowns
- `get-copilot-usage-all-orgs.ts` — Consolidated summary across all orgs

### Shared Modules

- `github-client.ts` — `getToken()` (reads `GITHUB_TOKEN` env var), `githubFetch<T>()` (single request), `githubFetchAll<T>()` (handles pagination via Link headers), `downloadReport()` (fetches a signed report link as text); all take an optional `AbortSignal`. `githubFetch` and `githubFetchAll` share one internal `request()` helper, which returns `data: null` for a 204 response. Requests send `Accept: application/vnd.github+json`, API version 2022-11-28 and a `copilot-mcp-server/<version>` User-Agent, with a 30 s timeout combined with the caller's signal. The Bearer token is sent only to `https://api.github.com`, never to other origins. `downloadReport()` never takes or sends the token, accepts only `https:` links, shares the 30 s timeout, and rejects files over 25 MB (by `content-length` and while streaming). Failures throw `ApiError` (`status`, `rateLimited`) with a recovery-oriented message that never includes the raw response body.
- `metrics-report.ts` — Zod schemas for the usage-metrics report files (28-day wrapper with `day_totals`, or a 1-day record; NDJSON, a JSON array or one object are all accepted, malformed lines are counted and skipped), the `reportLinks` envelope schema, `parseReportFile()` and `summarizeReports()` (Markdown summary).
- `version.ts` — Exports `version`, read once from `package.json`; used for the server info and the User-Agent.
- `schemas.ts` — Shared Zod schemas (`orgLogin`: validated GitHub org login, reused by the org-scoped tools, each adding its own `.describe()`).
- `types.ts` — TypeScript interfaces for GitHub API responses (`GitHubOrg`, `CopilotBilling`, `CopilotSeatDetail`, `CopilotSeatsResponse`).

### Patterns

- **Parameter validation**: Zod schemas with `.describe()` for MCP tool schema generation
- **Error handling**: try/catch in every handler returning `{ content: [...], isError: true }`
- **Response format**: All tools return Markdown text (tables, summaries)
- **No circular dependencies**: Tools depend on `github-client.ts`, `metrics-report.ts`, `schemas.ts` and `types.ts`; nothing depends on tools except `index.ts`

## Environment

Requires `GITHUB_TOKEN` env var with `manage_billing:copilot` and `read:org` scopes. `get_copilot_metrics` additionally needs an organization owner (or the "View Organization Copilot Metrics" permission) and the org's "Copilot usage metrics" policy enabled. Set in `.env` file (gitignored).
