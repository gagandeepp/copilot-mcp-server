# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

An MCP (Model Context Protocol) server that exposes GitHub Copilot management tools — billing, seats, metrics, and usage across organizations. Communicates over stdio using `@modelcontextprotocol/sdk`.

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

`src/index.ts` — Thin entrypoint (~30 lines) with `#!/usr/bin/env node` shebang. Creates `McpServer`, registers all tools, starts `StdioServerTransport`.

### Tool Modules (`src/tools/`)

Each tool is a standalone file exporting a single `register*` function:

```typescript
export function registerToolName(server: McpServer): void {
  server.registerTool("tool_name", { description, inputSchema }, handler);
}
```

Tools:
- `list-organizations.ts` — Lists all accessible GitHub orgs
- `get-copilot-billing-summary.ts` — Billing/seat breakdown for an org
- `get-copilot-seats.ts` — Individual seat assignments (paginated)
- `get-copilot-metrics.ts` — Daily usage metrics with editor/model breakdowns
- `get-copilot-usage-all-orgs.ts` — Consolidated summary across all orgs

### Shared Modules

- `github-client.ts` — `getToken()` (reads `GITHUB_TOKEN` env var), `githubFetch<T>()` (single request), `githubFetchAll<T>()` (handles pagination via Link headers). All requests use GitHub API v2022-11-28 with Bearer auth.
- `types.ts` — TypeScript interfaces for GitHub API responses (`GitHubOrg`, `CopilotBilling`, `CopilotSeatDetail`, `CopilotSeatsResponse`, `CopilotMetricDay`).

### Patterns

- **Parameter validation**: Zod schemas with `.describe()` for MCP tool schema generation
- **Error handling**: try/catch in every handler returning `{ content: [...], isError: true }`
- **Response format**: All tools return Markdown text (tables, summaries)
- **No circular dependencies**: Tools depend on `github-client.ts` and `types.ts`; nothing depends on tools except `index.ts`

## Environment

Requires `GITHUB_TOKEN` env var with `manage_billing:copilot` and `read:org` scopes. Set in `.env` file (gitignored).
