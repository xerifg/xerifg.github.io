import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
const ui = readFileSync(new URL("../static/library-ui.mjs", import.meta.url), "utf8");
const css = readFileSync(new URL("../static/app.css", import.meta.url), "utf8");

assert.match(app, /view:\s*"home"/);
assert.match(app, /activeId:\s*""/);
assert.match(app, /h\(PrimaryRail,/);
assert.match(app, /h\(LibraryHome,/);
assert.match(app, /h\(TagBrowser,/);
assert.match(ui, /from "https:\/\/esm\.sh\/lucide-react@0\.468\.0/);
assert.match(ui, /aria-label:\s*label/);
assert.match(ui, /export function TagBrowser/);
assert.match(app, /icon\("folder",\s*\{\s*className:\s*"tree-folder-icon"\s*\}\)/);
assert.match(app, /icon\("file",\s*\{\s*className:\s*"tree-note-icon"\s*\}\)/);
assert.match(app, /"aria-current":\s*isActive\s*\?\s*"page"\s*:\s*undefined/);
assert.match(css, /grid-template-columns:\s*56px 260px minmax\(0,\s*1fr\)/);
assert.match(css, /\.tag-browser-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(280px,\s*\.72fr\)/s);
assert.match(css, /@media\s*\(max-width:\s*1100px\)\s*\{[^}]*\.tag-browser-grid\s*\{[^}]*grid-template-columns:\s*1fr/s);
assert.doesNotMatch(app, /NetworkView/);
assert.doesNotMatch(app, /back-network/);

const enterTagSource = app.slice(app.indexOf("const enterTag ="), app.indexOf("const navigate ="));
assert.match(enterTagSource, /draft\.view\s*=\s*"tags"/);
assert.doesNotMatch(enterTagSource, /draft\.activeId\s*=/);

const tagOpenSource = app.slice(app.indexOf("const openTagNote ="), app.indexOf("const navigate ="));
assert.match(tagOpenSource, /tagReturnContext/);
assert.match(tagOpenSource, /selectNote\(noteId\)/);
assert.match(app, /back-to-tag/);
