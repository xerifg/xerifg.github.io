import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const css = readFileSync(new URL("../static/app.css", import.meta.url), "utf8");
assert.match(css, /button:not\(:disabled\)\s*\{[\s\S]*transition:/);
assert.match(css, /button:not\(:disabled\):active\s*\{[\s\S]*transform: scale\(\.97\)/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
