# Table Hover Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open the plus-menu table-size picker on pointer hover over `表格` and close it smoothly as soon as that menu item is left.

**Architecture:** `FeishuEditor` owns the picker visibility and a short close timer. `FeishuInsertMenu` reports entry and exit from its table item, while `TableInsertGrid` receives a closing flag so it remains mounted long enough to animate out. Existing position calculation, click-to-open, table insertion, and outside-click dismissal stay unchanged.

**Tech Stack:** React 18 via ESM, plain CSS, Node `assert` tests.

## Global Constraints

- The picker opens only while the pointer is over `表格`; entering the picker does not keep it open.
- Keep the current click behavior as a keyboard and touch fallback.
- Use existing surface, line, shadow, radius, and blue selection CSS tokens.
- Use opacity, 4 px horizontal movement, and subtle scale over roughly 140 ms; reduced motion removes movement.

---

### Task 1: Add hover lifecycle coverage

**Files:**
- Create: `tests/table-hover-picker.test.mjs`
- Modify: `tests/table-editor-integration.test.mjs`

**Interfaces:**
- Consumes: `FeishuInsertMenu` and `TableInsertGrid` source in `static/app.js`.
- Produces: regression assertions for table-item entry, delayed exit, re-entry cancellation, and picker motion classes.

- [ ] **Step 1: Write the failing test**

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../static/app.css", import.meta.url), "utf8");
const insertMenu = app.slice(app.indexOf("function FeishuInsertMenu"), app.indexOf("async function applyEditorCommand"));

assert.match(insertMenu, /onMouseEnter:.*onTableHoverStart/s);
assert.match(insertMenu, /onMouseLeave:.*onTableHoverEnd/s);
assert.match(app, /clearTimeout\(tablePickerCloseTimerRef\.current\)/);
assert.match(app, /setTimeout\(\(\) => setTablePicker\(null\), 100\)/);
assert.match(css, /\.table-insert-grid\.is-closing\s*\{[\s\S]*opacity:/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.table-insert-grid/s);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/table-hover-picker.test.mjs`

Expected: FAIL because hover callbacks, close timer, and closing-motion CSS do not yet exist.

- [ ] **Step 3: Implement only the behavior required by this test**

Add `tablePickerCloseTimerRef`, hover start/end callbacks in `FeishuEditor`, and pass callbacks to the table item. On leave, mark the picker closing and clear it after 100 ms; on re-entry, cancel the timer and restore the visible state. Pass `isClosing` to `TableInsertGrid`, and add the matching CSS transition and reduced-motion behavior.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/table-hover-picker.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add static/app.js static/app.css tests/table-hover-picker.test.mjs tests/table-editor-integration.test.mjs
git commit -m "feat: open table picker on hover"
```

### Task 2: Verify integration and visual behavior

**Files:**
- Modify: `static/app.js`
- Modify: `static/app.css`
- Test: `tests/*.test.mjs`

**Interfaces:**
- Consumes: the hover lifecycle and closing class from Task 1.
- Produces: a smooth, accessible picker that preserves existing insertion and dismissal behavior.

- [ ] **Step 1: Write the failing integration assertion**

```js
assert.match(app, /FeishuInsertMenu, \{ position: insertMenu, run, onTableHoverStart, onTableHoverEnd \}/);
assert.match(app, /TableInsertGrid, \{[\s\S]*isClosing: tablePickerClosing/s);
assert.doesNotMatch(app, /onMouseEnter: onClose/);
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node tests/table-editor-integration.test.mjs`

Expected: FAIL until the parent passes the hover handlers and closing state through the existing component boundary.

- [ ] **Step 3: Implement the minimal integration wiring**

Keep `run("table", { event, item })` for click activation. Change only the table item's props to call hover handlers, and append `is-closing` to the picker class while it exits. Do not add hover handlers to `TableInsertGrid`.

- [ ] **Step 4: Run all tests**

Run: `$tests = Get-ChildItem tests -Filter *.test.mjs; foreach ($test in $tests) { node $test.FullName; if ($LASTEXITCODE -ne 0) { exit 1 } }`

Expected: all test files PASS.

- [ ] **Step 5: Manually verify in a local browser**

Open a note in edit mode, click `+`, hover `表格`, move away, then click `表格` and select a grid size. Confirm hover opening, smooth close, no sticky picker when entering its grid, preserved click fallback, and successful table insertion.

- [ ] **Step 6: Commit**

```bash
git add static/app.js static/app.css tests/table-hover-picker.test.mjs tests/table-editor-integration.test.mjs
git commit -m "feat: refine table picker hover motion"
```
