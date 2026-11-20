import type { CallToolResult } from "@modelcontextprotocol/server";
import type { ResourceRef } from "../resource-uris.js";
import type { ResponseFormat } from "../schemas.js";
/**
 * Build a tool result in the requested format. JSON mode returns the data both as `structuredContent` and as JSON text
 * (for clients that only read `content`); Markdown mode returns only the rendered text.
 */
export declare function formatResult<T extends object>(data: T, format: ResponseFormat, renderMarkdown: (data: T) => string): CallToolResult;
/** An error result: plain text in both response formats. */
export declare function errorResult(message: string): CallToolResult;
/**
 * Add a `resource_link` block after the result's existing content, pointing at the resource that serves the same data
 * (the first block, and `structuredContent`, stay exactly as they were). Only for successful results.
 */
export declare function withResourceLink(result: CallToolResult, ref: ResourceRef): CallToolResult;
//# sourceMappingURL=result.d.ts.map