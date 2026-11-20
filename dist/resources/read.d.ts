import { ProtocolError } from "@modelcontextprotocol/server";
import type { ReadResourceResult } from "@modelcontextprotocol/server";
/** A resource's JSON text: the same data object the matching tool returns in JSON mode. Prompts embed this exact text. */
export declare const jsonText: (data: object) => string;
export declare function jsonContents(uri: URL, data: object): ReadResourceResult;
export declare const errorMessage: (err: unknown) => string;
/**
 * Turn a failed read into the error to throw. A resource callback has no `isError` channel, so every failure is a
 * JSON-RPC error that carries the same recovery-oriented message the tools return:
 * - GitHub 404: `ResourceNotFoundError`. The SDK answers it with -32602 and `data: { uri }` on every protocol era.
 * - anything else (no token, 401, 403, 429, 5xx, timeout, empty report): -32603 `InternalError`. The request and its
 *   parameters were valid and the server failed to produce the data; InvalidParams stays reserved for caller mistakes
 *   (bad org or day, unknown URI), and the other codes are protocol-level (method, version, capability, parse).
 */
export declare function resourceError(err: unknown, uri: URL, message?: string): ProtocolError;
/** The `{org}` URI variable, validated like the tools' `org` argument. Variables arrive raw (not decoded) and may be arrays. */
export declare function orgFromUri(value: string | string[] | undefined): string;
/** The `{day}` URI variable: YYYY-MM-DD and a real calendar date. */
export declare function dayFromUri(value: string | string[] | undefined): string;
//# sourceMappingURL=read.d.ts.map