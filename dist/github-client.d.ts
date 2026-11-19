export declare class ApiError extends Error {
    readonly status: number;
    readonly rateLimited: boolean;
    constructor(status: number, message: string, options: {
        rateLimited: boolean;
    });
}
export declare function getToken(): string;
export declare function githubFetch<T>(path: string, token: string, signal?: AbortSignal): Promise<T>;
/** Paginate through all pages of a GitHub list endpoint */
export declare function githubFetchAll<T>(path: string, token: string, signal?: AbortSignal): Promise<T[]>;
//# sourceMappingURL=github-client.d.ts.map