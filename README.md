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
Returns Copilot usage metrics for an organization from GitHub's usage-metrics reports: daily, weekly and monthly active users, prompts, code generations, acceptances and lines of code, broken down by IDE, feature, language and model (top 10 each), plus a per-day table for the 28-day report. By default it returns the latest 28-day report; with `day` it returns that single day.

**Parameters:** `org` (string), `day` (YYYY-MM-DD, optional) — a single day's report instead of the latest 28 days. Daily reports are available from 2025-10-10 and up to one year back; a day's data can take up to two full UTC days after it ends to appear. If there is no report for that day, the tool says so.

**Requirements:**
- An organization owner, or a user with the fine-grained "View Organization Copilot Metrics" permission. Classic personal access tokens need the `read:org` scope.
- The organization's "Copilot usage metrics" policy must be enabled.

The tool uses GitHub's `organization-28-day/latest` and `organization-1-day` report endpoints, which return short-lived signed download links. The tool downloads the report files itself (without sending your token) and rejects files over 25 MB.

### `get_copilot_usage_all_orgs`
Scans ALL organizations at once and returns a summary table showing seat counts and active/inactive users per org, plus grand totals.

## Breaking changes in 2.0.0

- Node.js 20.3 or later is required.
- Tool arguments are strict: unknown arguments are rejected instead of ignored.
- `get_copilot_metrics`: `since` and `until` are replaced by `day`. GitHub retired the legacy `/orgs/{org}/copilot/metrics` endpoint, so the tool now uses the usage-metrics reports API and returns a different summary (active users, prompts, generations, acceptances and lines, with IDE, feature, language and model breakdowns).

## VSCode Configuration

This repo includes a [`.vscode/mcp.json`](.vscode/mcp.json) file that automatically configures the MCP server for VSCode. When you open the project, VSCode will detect it and prompt you for your GitHub token.

To use it manually or in another project, create a `.vscode/mcp.json` file:

```json
{
  "servers": {
    "xxxx-copilot-mcp-server": {
      "command": "npx",
      "args": ["@xxxx-devops-qa/copilot-mcp-server"],
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

Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "xxxx-copilot-mcp-server": {
      "command": "npx",
      "args": ["-y", "@xxxx-devops-qa/copilot-mcp-server"],
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

## Publishing

### Publish to GitHub Packages

1. Scope the package to your org in `package.json`:

```json
"name": "@Xxxx-Devops-QA/copilot-mcp-server"
```

2. Add a `publishConfig` and `prepublishOnly` script:

```json
"publishConfig": {
  "registry": "https://npm.pkg.github.com"
},
"scripts": {
  "prepublishOnly": "npm run build"
}
```

3. Authenticate and publish:

```bash
npm login --registry=https://npm.pkg.github.com
npm publish
```

### Install from Git

Users can install directly from the repo without a registry:

```bash
npm install -g git+https://github.com/your-org/copilot-mcp-server.git
```

### Usage After Publishing

Users can run the server without cloning the repo:

```bash
npx @Xxxx-Devops-QA/copilot-mcp-server
```

Or reference it in their MCP client config:

```json
{
  "command": "npx",
  "args": ["-y", "@Xxxx-Devops-QA/copilot-mcp-server"],
  "env": {
    "GITHUB_TOKEN": "ghp_your_token_here"
  }
}
```

## License

ISC
