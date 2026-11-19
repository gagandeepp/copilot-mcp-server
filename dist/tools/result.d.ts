import type { CallToolResult } from "@modelcontextprotocol/server";
import type { ResponseFormat } from "../schemas.js";
/**
 * Build a tool result in the requested format. JSON mode returns the data both as `structuredContent` and as JSON text
 * (for clients that only read `content`); Markdown mode returns only the rendered text.
 */
export declare function formatResult<T extends object>(data: T, format: ResponseFormat, renderMarkdown: (data: T) => string): CallToolResult;
/** An error result: plain text in both response formats. */
export declare function errorResult(message: string): CallToolResult;
//# sourceMappingURL=result.d.ts.map