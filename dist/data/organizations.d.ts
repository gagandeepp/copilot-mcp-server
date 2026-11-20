export interface OrganizationsData {
    total_count: number;
    organizations: {
        id: number;
        login: string;
        description: string;
    }[];
}
export declare function fetchOrganizations(token: string, signal?: AbortSignal): Promise<OrganizationsData>;
export declare function renderOrganizationsMarkdown(data: OrganizationsData): string;
//# sourceMappingURL=organizations.d.ts.map