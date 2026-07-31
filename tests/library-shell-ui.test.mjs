import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
const ui = readFileSync(new URL("../static/library-ui.mjs", import.meta.url), "utf8");
const css = readFileSync(new URL("../static/app.css", import.meta.url), "utf8");

assert.match(app, /view:\s*"home"/);
assert.match(app, /activeId:\s*""/);
assert.match(app, /h\(PrimaryRail,/);
assert.match(app, /h\(LibraryHome,/);
assert.match(ui, /from "https:\/\/esm\.sh\/lucide-react@0\.468\.0/);
assert.match(ui, /aria-label:\s*label/);
assert.match(css, /grid-template-columns:\s*56px 260px minmax\(0,\s*1fr\)/);
assert.doesNotMatch(app, /NetworkView/);
assert.doesNotMatch(app, /back-network/);
