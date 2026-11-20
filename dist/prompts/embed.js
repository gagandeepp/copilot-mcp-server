import { JSON_MIME } from "../resource-uris.js";
import { errorMessage, jsonText } from "../resources/read.js";
export const userText = (text) => ({ role: "user", content: { type: "text", text } });
/**
 * One user message that embeds the resource at `ref.uri` (the same JSON text `resources/read` returns). `prompts/get`
 * must not fail because of GitHub, so if `load` throws (no token, 401/403/404/429/5xx, timeout) the message is a short
 * note that says so and points the model at the matching tool instead.
 *
 * @param fallbackTool  The tool that returns the same data, as a call the model can make, for example `get_copilot_billing_summary with org "acme" and response_format "json"`.
 * @param describe      Turns the error into text; metrics resources use their own messages.
 */
export async function embedResource(ref, fallbackTool, load, describe = errorMessage) {
    try {
        const data = await load();
        return { role: "user", content: { type: "resource", resource: { uri: ref.uri, mimeType: JSON_MIME, text: jsonText(data) } } };
    }
    catch (err) {
        return userText(`Note: the data of ${ref.uri} (${ref.name}) could not be loaded. ${describe(err)} ` +
            `Call ${fallbackTool} to get it, and tell me if that fails too.`);
    }
}
//# sourceMappingURL=embed.js.map