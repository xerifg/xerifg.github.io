import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const app = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
assert.match(app, /className: "toast", role: "status", "aria-live": "polite", "aria-atomic": "true"/);
