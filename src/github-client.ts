import { version } from "./version.js";

const GITHUB_API = "https://api.github.com";
const REQUEST_TIMEOUT_MS = 30_000;

export class ApiError extends Error {
    readonly rateLimited: boolean;

    constructor(readonly status: number, message: string, options: { rateLimited: boolean }) {
        super(message);
        this.name = "ApiError";
        this.rateLimited = options.rateLimited;
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

/** How to recover from a rate limit: GitHub's retry-after (seconds) or x-ratelimit-reset (epoch seconds). */
function retryAdvice(res: Response): string {
    const retryAfter = res.headers.get("retry-after");
    if (retryAfter !== null && Number.isFinite(Number(retryAfter))) {
        return `Retry after ${Number(retryAfter)} seconds.`;
    }
    const reset = res.headers.get("x-ratelimit-reset");
    if (reset !== null && Number.isFinite(Number(reset))) {
        return `Retry after ${new Date(Number(reset) * 1000).toISOString()}.`;
    }
    return "Try again later.";
}

/** Build an ApiError with a recovery-oriented message. Only GitHub's own `message` field is quoted, never the raw body. */
async function toApiError(res: Response): Promise<ApiError> {
    const { status } = res;
    const rateLimited =
        status === 429 ||
        (status === 403 &&
            (res.headers.get("x-ratelimit-remaining") === "0" || res.headers.get("retry-after") !== null));

    let message: string;
    if (rateLimited) {
        message = `GitHub rate limit exceeded (HTTP ${status}). ${retryAdvice(res)}`;
    } else if (status === 401) {
        message = "GitHub rejected the token (HTTP 401). Check that GITHUB_TOKEN is valid and not expired.";
    } else if (status === 403) {
        message =
            "GitHub denied access (HTTP 403). Copilot billing data requires an organization owner token " +
            "with the manage_billing:copilot or read:org scope.";
    } else if (status === 404) {
        message =
            "Not found (HTTP 404). Check the org login with list_organizations; " +
            "the org may not use Copilot, or the token cannot see it.";
    } else if (status === 422) {
        message = "GitHub could not process the request (HTTP 422).";
    } else if (status >= 500) {
        message = `GitHub returned HTTP ${status}. Try again later.`;
    } else {
        message = `GitHub API returned HTTP ${status}.`;
    }

    try {
        const body: unknown = JSON.parse(await res.text());
        const detail = (body as { message?: unknown } | null)?.message;
        if (typeof detail === "string") {
            message += ` GitHub says: "${detail.slice(0, 200)}"`;
        }
    } catch {
        // Body is not JSON (or could not be read): the status-based message stands on its own.
    }

    return new ApiError(status, message, { rateLimited });
}

/** One GitHub request: standard headers, token only for api.github.com, 30 s timeout combined with the caller's signal. */
async function request(
    url: string,
    token: string,
    signal?: AbortSignal
): Promise<{ data: unknown; link: string | null }> {
    const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": `copilot-mcp-server/${version}`,
    };
    if (new URL(url).origin === GITHUB_API) {
        headers.Authorization = `Bearer ${token}`;
    }

    try {
        // The timeout also covers reading the body, so parse it inside this try.
        const res = await fetch(url, {
            headers,
            signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
        });
        if (!res.ok) throw await toApiError(res);
        return { data: await res.json(), link: res.headers.get("link") };
    } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "TimeoutError") {
            throw new Error("GitHub did not respond within 30 seconds. Try again later.");
        }
        throw err;
    }
}

export async function githubFetch<T>(path: string, token: string, signal?: AbortSignal): Promise<T> {
    const url = path.startsWith("http") ? path : `${GITHUB_API}${path}`;
    const { data } = await request(url, token, signal);
    return data as T;
}

/** Paginate through all pages of a GitHub list endpoint */
export async function githubFetchAll<T>(path: string, token: string, signal?: AbortSignal): Promise<T[]> {
    const items: T[] = [];
    let url: string | null = path.startsWith("http")
        ? path
        : `${GITHUB_API}${path}`;

    while (url) {
        const { data, link } = await request(url, token, signal);
        items.push(...(data as T[]));

        // Parse Link header for next page
        url = null;
        if (link) {
            const match: RegExpMatchArray | null = link.match(/<([^>]+)>;\s*rel="next"/);
            if (match) url = match[1];
        }
    }

    return items;
}
