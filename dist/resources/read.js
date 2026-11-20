import { ProtocolError, ProtocolErrorCode, ResourceNotFoundError } from "@modelcontextprotocol/server";
import { ApiError } from "../github-client.js";
import { JSON_MIME } from "../resource-uris.js";
import { orgLogin } from "../schemas.js";
/** A resource's JSON text: the same data object the matching tool returns in JSON mode. Prompts embed this exact text. */
export const jsonText = (data) => JSON.stringify(data, null, 2);
export function jsonContents(uri, data) {
    return { contents: [{ uri: uri.href, mimeType: JSON_MIME, text: jsonText(data) }] };
}
export const errorMessage = (err) => (err instanceof Error ? err.message : String(err));
/**
 * Turn a failed read into the error to throw. A resource callback has no `isError` channel, so every failure is a
 * JSON-RPC error that carries the same recovery-oriented message the tools return:
 * - GitHub 404: `ResourceNotFoundError`. The SDK answers it with -32602 and `data: { uri }` on every protocol era.
 * - anything else (no token, 401, 403, 429, 5xx, timeout, empty report): -32603 `InternalError`. The request and its
 *   parameters were valid and the server failed to produce the data; InvalidParams stays reserved for caller mistakes
 *   (bad org or day, unknown URI), and the other codes are protocol-level (method, version, capability, parse).
 */
export function resourceError(err, uri, message = errorMessage(err)) {
    if (err instanceof ApiError && err.status === 404)
        return new ResourceNotFoundError(uri.href, message);
    return new ProtocolError(ProtocolErrorCode.InternalError, message);
}
const invalid = (message) => new ProtocolError(ProtocolErrorCode.InvalidParams, message);
/** The `{org}` URI variable, validated like the tools' `org` argument. Variables arrive raw (not decoded) and may be arrays. */
export function orgFromUri(value) {
    const parsed = orgLogin.safeParse(value);
    if (!parsed.success)
        throw invalid(`Invalid organization in the resource URI: ${parsed.error.issues[0].message}`);
    return parsed.data;
}
/** The `{day}` URI variable: YYYY-MM-DD and a real calendar date. */
export function dayFromUri(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw invalid("Invalid day in the resource URI: use YYYY-MM-DD, for example copilot://orgs/my-org/metrics/daily/2026-01-31");
    }
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        throw invalid(`Invalid day in the resource URI: ${value} is not a calendar date`);
    }
    return value;
}
//# sourceMappingURL=read.js.map