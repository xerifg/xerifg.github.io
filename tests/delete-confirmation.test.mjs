import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const app = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
assert.match(app, /draft\.modal = action === "delete-note" \? "confirm-delete-note" : "confirm-delete-folder"/);
assert.match(app, /if \(state\.modal === "confirm-delete-note"\)/);
assert.match(app, /if \(state\.modal === "confirm-delete-folder"\)/);
