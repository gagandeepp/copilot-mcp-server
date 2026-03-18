const GITHUB_API = "https://api.github.com";
export function getToken() {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
        throw new Error("GITHUB_TOKEN environment variable is not set. " +
            "Please set it to a GitHub personal access token with " +
            "'manage_billing:copilot', 'read:org' scopes.");
    }
    return token;
}
export async function githubFetch(path, token) {
    const url = path.startsWith("http") ? path : `${GITHUB_API}${path}`;
    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`GitHub API error ${res.status}: ${body}`);
    }
    return res.json();
}
/** Paginate through all pages of a GitHub list endpoint */
export async function githubFetchAll(path, token) {
    const items = [];
    let url = path.startsWith("http")
        ? path
        : `${GITHUB_API}${path}`;
    while (url) {
        const res = await fetch(url, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        });
        if (!res.ok) {
            const body = await res.text();
            throw new Error(`GitHub API error ${res.status}: ${body}`);
        }
        const data = (await res.json());
        items.push(...data);
        // Parse Link header for next page
        const link = res.headers.get("link");
        url = null;
        if (link) {
            const match = link.match(/<([^>]+)>;\s*rel="next"/);
            if (match)
                url = match[1];
        }
    }
    return items;
}
//# sourceMappingURL=github-client.js.map