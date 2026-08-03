import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const app = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
const source = app.slice(app.indexOf("function FeishuBubbleToolbar"), app.indexOf("function FeishuInsertMenu"));
assert.match(source, /"aria-label": "\\u6587\\u672c\\u6837\\u5f0f"/);
assert.match(source, /"aria-label": button\.title \|\| button\.command/);
