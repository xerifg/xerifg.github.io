import assert from "node:assert/strict";
import { filterCommandItems } from "../static/command-palette.mjs";
import { readFileSync } from "node:fs";

assert.deepEqual(filterCommandItems([{ id: "new-note", label: "新建笔记" }, { id: "settings", label: "打开设置" }], "设置").map((item) => item.id), ["settings"]);
const app = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
assert.match(app, /event\.key\.toLowerCase\(\) === "k"/);
const workspace = readFileSync(new URL("../static/knowledge-ui.mjs", import.meta.url), "utf8");
assert.match(app, /h\(QuickOpen/);
assert.match(workspace, /role: "dialog"/);
assert.match(workspace, /event\.key === "Tab"/);
assert.match(workspace, /button:not\(:disabled\), input:not\(:disabled\)/);
assert.match(workspace, /\["ArrowDown", "ArrowUp"\]/);
assert.match(workspace, /event\.key === "Enter"/);
