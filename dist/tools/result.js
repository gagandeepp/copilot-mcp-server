import { JSON_MIME } from "../resource-uris.js";
/**
 * Build a tool result in the requested format. JSON mode returns the data both as `structuredContent` and as JSON text
 * (for clients that only read `content`); Markdown mode returns only the rendered text.
 */
export function formatResult(data, format, renderMarkdown) {
    if (format === "json") {
        return {
            content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
            structuredContent: data,
        };
    }
    return { content: [{ type: "text", text: renderMarkdown(data) }] };
}
/** An error result: plain text in both response formats. */
export function errorResult(message) {
    return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}
/**
 * Add a `resource_link` block after the result's existing content, pointing at the resource that serves the same data
 * (the first block, and `structuredContent`, stay exactly as they were). Only for successful results.
 */
export function withResourceLink(result, ref) {
    return { ...result, content: [...result.content, { type: "resource_link", uri: ref.uri, name: ref.name, mimeType: JSON_MIME }] };
}
//# sourceMappingURL=result.js.map