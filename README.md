# GitHub Copilot Usage MCP Server
 
An MCP (Model Context Protocol) server that exposes GitHub Copilot usage data across all your organizations. Built with TypeScript and the official MCP SDK.
 
## Prerequisites
 
- Node.js 18+
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
 
This server exposes 5 tools:
 
### `list_organizations`
Lists all GitHub organizations the authenticated user belongs to, with IDs. Use the org `login` value for all subsequent queries.
 
### `get_copilot_billing_summary`
Returns the Copilot billing summary for an organization: total seats, active/inactive breakdown, plan type, and feature enablement (IDE chat, CLI, etc.).
 
**Parameters:** `org` (string) — the organization login/slug.
 
### `get_copilot_seats`
Lists all individual Copilot seat assignments with per-user details: last activity date, editor used, assigned team, plan type, and pending cancellation status.
 
**Parameters:** `org` (string), `page` (number, optional, default 1).
 
### `get_copilot_metrics`
Returns aggregated daily Copilot usage metrics: active users, engaged users, code completions, IDE chat, web chat, and PR summaries — broken down by editor and model.
 
**Parameters:** `org` (string), `since` (YYYY-MM-DD, optional), `until` (YYYY-MM-DD, optional).
 
### `get_copilot_usage_all_orgs`
Scans ALL organizations at once and returns a summary table showing seat counts and active/inactive users per org, plus grand totals.
 
## Claude Desktop Configuration
 
Add to your `claude_desktop_config.json`:
 
```json
{
  "mcpServers": {
    "github-copilot": {
      "command": "node",
      "args": ["/absolute/path/to/github-copilot-mcp/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```
 
## Claude Code Configuration
 
```bash
claude mcp add github-copilot -- node /absolute/path/to/github-copilot-mcp/dist/index.js
```
 
Make sure `GITHUB_TOKEN` is set in your shell environment.
 
## Required GitHub Token Scopes
 
| Scope | Purpose |
|-------|---------|
| `manage_billing:copilot` | Read Copilot billing and seat data |
| `read:org` | List organizations and their metadata |
 
## License
 
ISC
 