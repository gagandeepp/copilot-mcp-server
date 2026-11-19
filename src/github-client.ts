const GITHUB_API = "https://api.github.com";

export class ApiError extends Error {
    constructor(readonly status: number, message: string) {
        super(message);
        this.name = "ApiError";
    }
}

export function getToken(): string {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
        throw new Error(
            "GITHUB_TOKEN environment variable is not set. " +
            "Please set it to a GitHub personal access token with " +
            "'manage_billing:copilot', 'read:org' scopes."
        );
    }
    return token;
}

export async function githubFetch<T>(path: string, token: string): Promise<T> {
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
        throw new ApiError(res.status, `GitHub API error ${res.status}: ${body}`);
    }

    return res.json() as Promise<T>;
}

/** Paginate through all pages of a GitHub list endpoint */
export async function githubFetchAll<T>(path: string, token: string): Promise<T[]> {
    const items: T[] = [];
    let url: string | null = path.startsWith("http")
        ? path
        : `${GITHUB_API}${path}`;

    while (url) {
        const res: Response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        });

        if (!res.ok) {
            const body = await res.text();
            throw new ApiError(res.status, `GitHub API error ${res.status}: ${body}`);
        }

        const data = (await res.json()) as T[];
        items.push(...data);

        // Parse Link header for next page
        const link: string | null = res.headers.get("link");
        url = null;
        if (link) {
            const match: RegExpMatchArray | null = link.match(/<([^>]+)>;\s*rel="next"/);
            if (match) url = match[1];
        }
    }

    return items;
}
