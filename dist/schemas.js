import * as z from "zod/v4";
// Shared by every tool that takes an organization. Call `.describe()` per tool to give each its own description.
export const orgLogin = z
    .string()
    .min(1)
    .max(39)
    .regex(/^[A-Za-z0-9](?:[A-Za-z0-9_-]*[A-Za-z0-9])?$/, "Must be a GitHub organization login; use list_organizations to find it");
// Shared by every tool: 'json' returns the data as structuredContent (and as JSON text), 'markdown' a readable summary.
export const responseFormat = z
    .enum(["markdown", "json"])
    .default("markdown")
    .describe("'markdown' (default) for a readable summary, 'json' for structured data");
//# sourceMappingURL=schemas.js.map