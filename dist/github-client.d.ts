export declare class ApiError extends Error {
    readonly status: number;
    readonly rateLimited: boolean;
    constructor(status: number, message: string, options: {
        rateLimited: boolean;
    });
}
export declare function getToken(): string;
/**
 * Download a signed report link as text. The link carries its own credentials, so the GitHub token is never
 * accepted or sent. Only https links are allowed, and files over 25 MB are rejected (by content-length and while streaming).
 */
export declare function downloadReport(url: string, signal?: AbortSignal): Promise<string>;
export declare function githubFetch<T>(path: string, token: string, signal?: AbortSignal): Promise<T>;
/** Paginate through all pages of a GitHub list endpoint */
export declare function githubFetchAll<T>(path: string, token: string, signal?: AbortSignal): Promise<T[]>;
//# sourceMappingURL=github-client.d.ts.map