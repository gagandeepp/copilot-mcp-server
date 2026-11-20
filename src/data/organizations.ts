import { githubFetchAll } from "../github-client.js";
import { cell } from "../markdown.js";
import type { GitHubOrg } from "../types.js";

export interface OrganizationsData {
    total_count: number;
    organizations: { id: number; login: string; description: string }[];
}

export async function fetchOrganizations(token: string, signal?: AbortSignal): Promise<OrganizationsData> {
    const orgs = await githubFetchAll<GitHubOrg>("/user/orgs?per_page=100", token, signal);
    return {
        total_count: orgs.length,
        organizations: orgs.map((o) => ({
            id: o.id,
            login: o.login,
            description: o.description || "",
        })),
    };
}

export function renderOrganizationsMarkdown(data: OrganizationsData): string {
    if (data.total_count === 0) return "No organizations found for the authenticated user.";

    return (
        `Found ${data.total_count} organization(s):\n\n` +
        `| ID | Login (use this as org) | Description |\n` +
        `|----|------------------------|-------------|\n` +
        data.organizations
            .map((o) => `| ${o.id} | ${cell(o.login)} | ${cell(o.description)} |`)
            .join("\n")
    );
}
