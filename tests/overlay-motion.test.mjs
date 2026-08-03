import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const css = readFileSync(new URL("../static/app.css", import.meta.url), "utf8");
assert.match(css, /\.create-menu,\s*\.document-overflow-menu,\s*\.table-toolbar-popover[\s\S]*animation: overlayEnter/);
assert.match(css, /@keyframes overlayEnter/);
