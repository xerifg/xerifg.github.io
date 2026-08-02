import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const app = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
assert.match(app, /copyButton\.setAttribute\("aria-live", "polite"\)/);
assert.match(app, /copyButton\.textContent = "\\u5df2\\u590d\\u5236"/);
assert.match(app, /copyButton\.textContent = "\\u590d\\u5236\\u5931\\u8d25"/);
