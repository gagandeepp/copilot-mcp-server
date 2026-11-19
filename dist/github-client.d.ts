export declare class ApiError extends Error {
    readonly status: number;
    constructor(status: number, message: string);
}
export declare function getToken(): string;
export declare function githubFetch<T>(path: string, token: string): Promise<T>;
/** Paginate through all pages of a GitHub list endpoint */
export declare function githubFetchAll<T>(path: string, token: string): Promise<T[]>;
//# sourceMappingURL=github-client.d.ts.map