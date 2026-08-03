import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../static/app.css", import.meta.url), "utf8");
const insertMenu = app.slice(app.indexOf("function FeishuInsertMenu"), app.indexOf("async function applyEditorCommand"));

assert.match(insertMenu, /onMouseEnter:.*onTableHoverStart/s);
assert.match(insertMenu, /onMouseLeave:.*onTableHoverEnd/s);
assert.doesNotMatch(insertMenu, /onTablePickerEnter|onTablePickerLeave/);
assert.match(app, /clearTimeout\(tablePickerCloseTimerRef\.current\)/);
assert.match(app, /setTimeout\(\(\) => \{[\s\S]*setTablePicker\(null\);[\s\S]*\}, 100\)/);
assert.match(app, /onTablePickerEnter: cancelTablePickerClose/);
assert.match(app, /onTablePickerLeave: closeTablePicker/);
assert.match(app, /onMouseEnter: onTablePickerEnter/);
assert.match(app, /onMouseLeave: onTablePickerLeave/);
assert.match(css, /\.table-insert-grid\.is-closing\s*\{[\s\S]*animation:\s*tablePickerOut/);
assert.match(css, /@keyframes tablePickerOut/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.table-insert-grid/s);
