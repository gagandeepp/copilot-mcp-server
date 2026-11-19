import type { CallToolResult } from "@modelcontextprotocol/server";
import type { ResponseFormat } from "../schemas.js";

/**
 * Build a tool result in the requested format. JSON mode returns the data both as `structuredContent` and as JSON text
 * (for clients that only read `content`); Markdown mode returns only the rendered text.
 */
export function formatResult<T extends object>(
    data: T,
    format: ResponseFormat,
    renderMarkdown: (data: T) => string
): CallToolResult {
    if (format === "json") {
        return {
            content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
            structuredContent: data,
        };
    }
    return { content: [{ type: "text", text: renderMarkdown(data) }] };
}

/** An error result: plain text in both response formats. */
export function errorResult(message: string): CallToolResult {
    return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}
