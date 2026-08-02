import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const app = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../static/app.css", import.meta.url), "utf8");
assert.match(app, /"aria-live": "polite"/);
assert.match(app, /"data-state": localPersistenceStatus/);
assert.match(css, /\.document-save-status\[data-state="error"\]/);
