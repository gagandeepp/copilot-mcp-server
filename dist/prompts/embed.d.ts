import type { PromptMessage } from "@modelcontextprotocol/server";
import type { ResourceRef } from "../resource-uris.js";
export declare const userText: (text: string) => PromptMessage;
/**
 * One user message that embeds the resource at `ref.uri` (the same JSON text `resources/read` returns). `prompts/get`
 * must not fail because of GitHub, so if `load` throws (no token, 401/403/404/429/5xx, timeout) the message is a short
 * note that says so and points the model at the matching tool instead.
 *
 * @param fallbackTool  The tool that returns the same data, as a call the model can make, for example `get_copilot_billing_summary with org "acme" and response_format "json"`.
 * @param describe      Turns the error into text; metrics resources use their own messages.
 */
export declare function embedResource(ref: ResourceRef, fallbackTool: string, load: () => Promise<object>, describe?: (err: unknown) => string): Promise<PromptMessage>;
//# sourceMappingURL=embed.d.ts.map