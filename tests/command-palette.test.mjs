import assert from "node:assert/strict";
import { filterCommandItems } from "../static/command-palette.mjs";
import { readFileSync } from "node:fs";

assert.deepEqual(filterCommandItems([{ id: "new-note", label: "新建笔记" }, { id: "settings", label: "打开设置" }], "设置").map((item) => item.id), ["settings"]);
const app = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
assert.match(app, /event\.key\.toLowerCase\(\) === "k"/);
assert.match(app, /className: "command-palette"/);
assert.match(app, /role: "dialog"/);
assert.match(app, /event\.key !== "Tab"/);
assert.match(app, /querySelectorAll\("input:not\(:disabled\), button:not\(:disabled\)"\)/);
