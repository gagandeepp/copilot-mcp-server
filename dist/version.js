import { readFileSync } from "node:fs";
// package.json sits one level above both src/ and dist/, so this resolves to the package root in either layout.
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
export const version = pkg.version;
//# sourceMappingURL=version.js.map