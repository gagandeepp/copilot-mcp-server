# GitHub Copilot Usage MCP Server

An MCP (Model Context Protocol) server that exposes GitHub Copilot usage data across all your organizations. Built with TypeScript and the official MCP SDK.

## Prerequisites

- Node.js 20.3+
- A GitHub Personal Access Token (classic) with these scopes:
  - `manage_billing:copilot` — to read Copilot billing/seat data
  - `read:org` — to list organizations

## Setup

```bash
# Install dependencies
npm install

# Build
npm run build

# Set your GitHub token
export GITHUB_TOKEN="ghp_your_token_here"

# Run the server (stdio transport)
npm start
```

## MCP Tools

This server exposes 5 tools, plus [resources](#resources) and [prompts](#prompts) for the same data. Every tool takes an optional `response_format` (`"markdown"` by default, or `"json"`); see [Response formats](#response-formats).

### `list_organizations`
Lists all GitHub organizations the authenticated user belongs to, with IDs. Use the org `login` value for all subsequent queries.

**Parameters:** `response_format` (optional).

### `get_copilot_billing_summary`
Returns the Copilot billing summary for an organization: total seats, active/inactive breakdown, plan type, and feature enablement (IDE chat, CLI, etc.).

**Parameters:** `org` (string) — the organization login/slug; `response_format` (optional).

### `get_copilot_seats`
Lists all individual Copilot seat assignments with per-user details: last activity date, editor used, assigned team, plan type, and pending cancellation status.

**Parameters:** `org` (string), `page` (number, optional, default 1), `per_page` (number, 1-100, optional, default 50), `response_format` (optional).

### `get_copilot_metrics`
Returns Copilot usage metrics for an organization from GitHub's usage-metrics reports: daily, weekly and monthly active users, prompts, code generations, acceptances and lines of code, broken down by IDE, feature, language and model (top 10 each), plus a per-day table for the 28-day report. By default it returns the latest 28-day report; with `day` it returns that single day.

**Parameters:** `org` (string), `response_format` (optional), `day` (YYYY-MM-DD, optional) — a single day's report instead of the latest 28 days. Daily reports are available from 2025-10-10 and up to one year back; a day's data can take up to two full UTC days after it ends to appear. If there is no report for that day, the tool says so.

**Requirements:**
- An organization owner, or a user with the fine-grained "View Organization Copilot Metrics" permission. Classic personal access tokens need the `read:org` scope.
- The organization's "Copilot usage metrics" policy must be enabled.

The tool uses GitHub's `organization-28-day/latest` and `organization-1-day` report endpoints, which return short-lived signed download links. The tool downloads the report files itself (without sending your token) and rejects files over 25 MB.

### `get_copilot_usage_all_orgs`
Scans ALL organizations at once and returns a summary table showing seat counts and active/inactive users per org, plus grand totals.

**Parameters:** `response_format` (optional).

## Response formats

Every tool accepts `response_format`:

- `"markdown"` (default): a readable summary, as tables and short notes. In table cells, `|` is escaped as `\|` and line breaks become a space, so a stray character in an org description or team name cannot break a row.
- `"json"`: the data as an object, returned both as `structuredContent` and as pretty-printed JSON in the text content (for clients that only read text). Strings are raw (not Markdown-escaped).

Errors are a plain `isError` text result in both formats. The tools declare no `outputSchema`, because the output shape depends on `response_format`.

A successful `get_copilot_billing_summary` or `get_copilot_metrics` result has a second content block after the text: a `resource_link` (`mimeType: "application/json"`) to the [resource](#resources) that serves the same data (`copilot://orgs/{org}/billing`, `.../metrics/28-day`, or `.../metrics/daily/{day}` when `day` was given). The first block and `structuredContent` are unchanged.

The JSON shapes are stable: keys are snake_case, and a value that is missing is `null` rather than absent, except where noted.

### `list_organizations`

```json
{
  "total_count": 2,
  "organizations": [{ "id": 1, "login": "acme", "description": "Acme Corp" }]
}
```

`description` is an empty string when the organization has none.

### `get_copilot_billing_summary`

```json
{
  "org": "acme",
  "plan_type": "business",
  "seat_management_setting": "assign_selected",
  "seat_breakdown": {
    "total": 25,
    "added_this_cycle": 3,
    "pending_cancellation": 2,
    "pending_invitation": 1,
    "active_this_cycle": 20,
    "inactive_this_cycle": 5
  },
  "features": { "public_code_suggestions": "block", "ide_chat": "enabled", "platform_chat": "enabled", "cli": "enabled" }
}
```

### `get_copilot_seats`

```json
{
  "org": "acme",
  "page": 1,
  "per_page": 50,
  "total_seats": 250,
  "count": 2,
  "has_more": true,
  "next_page": 2,
  "seats": [
    {
      "login": "alice",
      "type": "User",
      "team": "Platform",
      "plan_type": "business",
      "last_activity_at": "2026-11-01T00:00:00Z",
      "last_authenticated_at": "2026-11-18T09:00:00Z",
      "last_activity_editor": "vscode/1.99.0/copilot-chat/0.26.0",
      "pending_cancellation_date": null,
      "created_at": "2026-01-01T00:00:00Z"
    }
  ]
}
```

`count` is the number of seats on this page. `next_page` is present only when `has_more` is `true`. `team` is `null` when the seat is not assigned through a team. A page with no seats has `seats: []`, `count: 0` and `has_more: false`.

### `get_copilot_metrics`

When GitHub has no report to give (HTTP 204, or a report with no download links), the result is:

```json
{ "org": "acme", "day": "2026-11-18", "available": false, "message": "No Copilot usage metrics report exists for ..." }
```

`day` is present only when a day was requested. Otherwise the result is the report summary (`available` is `true`):

```json
{
  "org": "acme",
  "available": true,
  "period": { "start": "2026-11-17", "end": "2026-11-19" },
  "day_count": 3,
  "malformed_lines": 0,
  "active_users": {
    "as_of_day": "2026-11-19",
    "daily": 4, "weekly": 7, "monthly": 11, "monthly_chat": 7, "monthly_agent": 0,
    "peak_daily": 4, "average_daily": 3
  },
  "feature_engagement": [{ "feature": "chat", "engaged_user_count": 7 }],
  "activity": {
    "all": { "user_initiated_interaction_count": 60, "code_generation_activity_count": 48, "code_acceptance_activity_count": 24, "loc_suggested_to_add_sum": 600, "loc_added_sum": 360, "loc_deleted_sum": 15 },
    "code_completions": { "...": "same six counts, or null when the report has no code completion rows" },
    "chat": { "...": "same six counts, or null when the report has no chat rows" }
  },
  "by_ide": [{ "name": "vscode", "user_initiated_interaction_count": 48, "...": "the other five counts" }],
  "by_feature": [],
  "by_language": [],
  "by_model": [],
  "daily": [{ "day": "2026-11-17", "daily_active_users": 2, "user_initiated_interaction_count": 10, "...": "the other five counts" }]
}
```

- `period` is the first and last date the report covers (equal for a single day); both are `null` if the report has no dates. `day_count` is the number of daily records, and `malformed_lines` the report lines that were skipped.
- `active_users` are distinct-user counts, taken from the latest day (they cannot be summed across days). `peak_daily` and `average_daily` are `null` unless the report covers more than one day.
- `feature_engagement` (28-day report only) counts users active on at least 2 days of the window per feature; features overlap, so do not add them.
- `activity` is the sum over the period. A count the report does not give is `null`, never `0`. In the Markdown these columns are Prompts (`user_initiated_interaction_count`), Generations (`code_generation_activity_count`), Accepted (`code_acceptance_activity_count`), Lines suggested (`loc_suggested_to_add_sum`) and Lines added (`loc_added_sum`).
- `by_ide`, `by_feature`, `by_language` and `by_model` are **complete** lists sorted by prompts + generations (then lines added, then name), best first. The Markdown shows only the top 10 of each. `by_model` is chat activity only.
- `daily` has one row per dated day, oldest first (a single row for a one-day report).

### `get_copilot_usage_all_orgs`

```json
{
  "organizations_scanned": 3,
  "totals": { "seats": 20, "active": 12, "inactive": 8 },
  "organizations": [
    { "login": "ok-1", "status": "ok", "plan_type": "business",
      "seat_breakdown": { "total": 10, "added_this_cycle": 0, "pending_cancellation": 0, "pending_invitation": 0, "active_this_cycle": 6, "inactive_this_cycle": 4 } },
    { "login": "nocop", "status": "skipped", "reason": "No Copilot subscription or no access" },
    { "login": "rl429", "status": "failed", "reason": "HTTP 429 (rate limited)" }
  ],
  "skipped_count": 1,
  "failed_count": 1,
  "incomplete": true
}
```

`organizations` lists the successes first, then the skipped orgs (no Copilot subscription, no access or insufficient permissions), then the failed ones (rate limit, server or network error), each group in the order GitHub listed the orgs; this is the same order as the Markdown rows. `totals` cover only the `ok` orgs, and `incomplete` is `true` when at least one org failed. Progress notifications are sent as before while the orgs are scanned.

## Resources

The same data is also readable as MCP resources, for clients that attach resources as context instead of calling tools. Every resource has `mimeType: "application/json"`, and its content is the pretty-printed JSON of exactly the object the matching tool returns in `response_format: "json"` (shapes above).

| URI | Returns | Cache hint (2026-07-28 clients) |
|-----|---------|------------------|
| `copilot://orgs` | the organizations the token can see (`list_organizations`) | 1 hour, private |
| `copilot://orgs/{org}/billing` | the billing summary of one org (`get_copilot_billing_summary`) | 10 minutes, private |
| `copilot://orgs/{org}/metrics/28-day` | the latest 28-day metrics summary (`get_copilot_metrics`) | 1 hour, private |
| `copilot://orgs/{org}/metrics/daily/{day}` | the metrics summary of one UTC day, `{day}` as `YYYY-MM-DD` (`get_copilot_metrics` with `day`) | 24 hours, private |

- `resources/list` lists `copilot://orgs` plus one billing and one 28-day entry per organization the token can see (titled `Copilot billing: <org>` and `Copilot 28-day metrics: <org>`). Daily URIs are not listed (one per org and day is unbounded); build them yourself. If GitHub cannot be reached (no token, API error) the per-org entries are left out and `copilot://orgs` is still listed. `resources/templates/list` shows the three templates.
- The `{org}` variable of every template supports completion (`completion/complete`): the org logins starting with what you typed, case-insensitive, at most 100. The org list is fetched once and cached in memory for 5 minutes, and shared with `resources/list`. If it cannot be fetched, completion returns an empty list instead of an error.
- No report is not an error: a 204 or a report without download links reads as JSON with `available: false` and a `message`, like the tool.
- Errors have no `isError` channel on resources, so they are JSON-RPC errors with the tool's recovery-oriented message. A GitHub 404 (unknown org, or the metrics policy is off) is "resource not found": code `-32602` with `data: { uri }` (the SDK's `ResourceNotFoundError`, on both protocol eras). A malformed `{org}` or `{day}` (not a GitHub login, not a real `YYYY-MM-DD` date) is a plain `-32602` without that data. Anything else (no token, 401, 403, 429, 5xx, timeout) is `-32603` with the message, for example `GitHub denied access (HTTP 403). ...`.
- Caching: clients speaking the 2026-07-28 revision get `ttlMs` and `cacheScope` on the lists and reads (see the table; all reads are `private` because they depend on the token). `resources/list` is cached for 5 minutes (private), `resources/templates/list` for an hour (public). 2025-era clients get no cache fields.

## Prompts

Four prompts package common reviews. Prompt arguments are strings; the model then calls the tools or reads the embedded data. Where the data exists as a resource, the prompt embeds it as `resource` content blocks (`mimeType: "application/json"`, the same text as `resources/read`), followed by a final message with the instructions. If GitHub cannot provide an embedded resource (no token, 403, 404, ...), that block becomes a short text note saying so and naming the tool to call instead, so `prompts/get` never fails because of GitHub. Invalid arguments are rejected with `-32602`; unknown arguments too.

| Prompt | Arguments | What it asks the model to do |
|--------|-----------|------------------------------|
| `copilot_inactive_seats_review` | `org` (completable); `inactive_days` (digits, default `30`) | Page through `get_copilot_seats` (`response_format: "json"`, `per_page: 100`) until `has_more` is false, list the seats whose `last_activity_at` is null or older than `inactive_days` plus the pending cancellations, group them by team, estimate the monthly savings (stating the per-seat list price it assumes for each `plan_type`), and output a removal-candidate table. Nothing is embedded: seats are only available as a tool. |
| `copilot_adoption_report` | `org` (completable) | Embeds `copilot://orgs/{org}/billing` and `copilot://orgs/{org}/metrics/28-day`. Report the adoption rate (active seats / total seats), engaged and active users, completions vs chat, the top IDEs, languages and models, and three concrete recommendations. |
| `copilot_org_comparison` | `min_active_pct` (0-100, default `50`) | Call `get_copilot_usage_all_orgs` (`response_format: "json"`), rank the organizations by utilization (active / total seats), flag those below the threshold, list skipped and failed orgs separately and say when the totals are incomplete. |
| `copilot_billing_forecast` | `org` (completable) | Embeds `copilot://orgs/{org}/billing`. Explain the seats added this cycle, the pending invitations and cancellations, and the expected seat count next cycle with its reasoning. |

The `org` argument completes from the same cached org list as the resource templates. `prompts/list` is cacheable for an hour (public) on 2026-07-28 clients. The inactive-seats prompt includes today's date and the cutoff date in its instructions, since the model cannot be assumed to know the date.

## Breaking changes in 2.0.0

- Node.js 20.3 or later is required.
- Tool arguments are strict: unknown arguments are rejected instead of ignored.
- `get_copilot_metrics`: `since` and `until` are replaced by `day`. GitHub retired the legacy `/orgs/{org}/copilot/metrics` endpoint, so the tool now uses the usage-metrics reports API and returns a different summary (active users, prompts, generations, acceptances and lines, with IDE, feature, language and model breakdowns).

## VSCode Configuration

This repo includes a [`.vscode/mcp.json`](.vscode/mcp.json) file that runs the local build (`dist/index.js`, after `npm install`) for VSCode. When you open the project, VSCode will detect it and prompt you for your GitHub token.

To use the published package in another project, create a `.vscode/mcp.json` file. This needs the `@gagandeepp` scope mapped to GitHub Packages in your `~/.npmrc` first (see [Installing from GitHub Packages](#installing-from-github-packages)): without that mapping, `npx` looks the name up on npmjs.org instead, where the `@gagandeepp` scope is not this project's, and would hand your `GITHUB_TOKEN` to whatever it finds there.

```json
{
  "servers": {
    "copilot-mcp-server": {
      "command": "npx",
      "args": ["-y", "@gagandeepp/copilot-mcp-server"],
      "env": {
        "GITHUB_TOKEN": "${input:github-token}"
      }
    }
  },
  "inputs": [
    {
      "id": "github-token",
      "type": "promptString",
      "description": "GitHub Personal Access Token with manage_billing:copilot and read:org scopes",
      "password": true
    }
  ]
}
```

## Claude Desktop Configuration

Map the `@gagandeepp` scope to GitHub Packages first, as for VSCode above, then add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "copilot-mcp-server": {
      "command": "npx",
      "args": ["-y", "@gagandeepp/copilot-mcp-server"],
      "env": {
        "GITHUB_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```

## Required GitHub Token Scopes

| Scope | Purpose |
|-------|----------|
| `manage_billing:copilot` | Read Copilot billing and seat data |
| `read:org` | List organizations and their metadata |

## Development

```bash
npm run build    # compile src/ to dist/
npm test         # build, then run the test suite (no network and no token needed)
npm run smoke    # live smoke test against the real GitHub API (needs GITHUB_TOKEN)
```

`npm test` uses Node's built-in test runner (Node 20.3+) against the built server in `dist/`. The tests start the server with a fake `GITHUB_TOKEN` and a preloaded `fetch` mock, connect a real MCP client in both protocol eras (2026-07-28 and 2025-11-25), and check, among other things, that the Markdown output of every tool matches the golden files in `test/fixtures/golden/` and that `response_format: "json"` matches the documented shapes.

`npm run smoke` starts the built server and calls it for real: it checks that 5 tools are listed, that `list_organizations` works, prints the outcome of billing, seats and metrics for your first organization (HTTP 403/404 are reported, not failures, since your token may not be an organization owner), and checks that invalid input is rejected. It then checks the [resources](#resources) (the lists and templates, that reads match the tools' JSON, that an unknown org is "resource not found", and the cache hints) and the [prompts](#prompts) (4 listed, an embedded resource in `copilot_adoption_report`, `org` completion), again reporting rather than failing on HTTP 403/404. It needs `GITHUB_TOKEN` in the environment or in `.env`, and exits non-zero only on a real failure.

`dist/` is committed (installing from a git URL relies on it), so run `npm run build` and commit the result with your source changes.

## Publishing

The package is published to GitHub Packages as `@gagandeepp/copilot-mcp-server` (`publishConfig` in `package.json`).

### Installing from GitHub Packages

GitHub Packages needs a token even to install a public package. Once per machine, add the scope and a token to `~/.npmrc`:

```ini
@gagandeepp:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=<a GitHub token with the read:packages scope>
```

Then run the server without cloning the repo, or use the VS Code and Claude Desktop configurations above:

```bash
npx -y @gagandeepp/copilot-mcp-server
```

### Install from Git

Without a registry or a packages token, install straight from the repo (`dist/` is committed for this):

```bash
npm install -g git+https://github.com/gagandeepp/copilot-mcp-server.git
```

### Releasing a new version

1. Bump the version (`npm version patch|minor|major --no-git-tag-version`), run `npm test`, and commit the result including `dist/`.
2. Publish with a token that has the `write:packages` scope (`prepublishOnly` rebuilds `dist/` first):

```bash
npm publish --registry=https://npm.pkg.github.com
```

3. Tag the release (`git tag v<version> && git push origin v<version>`).

## License

ISC
