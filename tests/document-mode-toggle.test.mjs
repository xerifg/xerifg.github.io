import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
const ui = readFileSync(new URL("../static/library-ui.mjs", import.meta.url), "utf8");
const topbar = app.slice(app.indexOf("function renderDocumentTopbar"), app.indexOf("function DocumentOverflowMenu"));

assert.match(ui, /BookOpenText[\s\S]*read:\s*BookOpenText/, "the shared icon map should provide a book icon for reading mode");
assert.match(app, /mode:\s*"read"/, "the initial document state should remain reading mode");
assert.match(topbar, /icon\(state\.mode === "read" \? "read" : "edit"/, "the mode toggle should use the icon for its current state");
assert.match(topbar, /state\.mode === "read" \? "阅读" : "编辑"/, "the mode toggle should name its current state");
assert.match(topbar, /state\.mode === "edit" \? "active" : ""/, "only editing mode should receive the highlighted styling");
assert.match(app, /draft\.mode = draft\.mode === "edit" \? "read" : "edit"/, "clicking the control should retain the existing mode transition");
