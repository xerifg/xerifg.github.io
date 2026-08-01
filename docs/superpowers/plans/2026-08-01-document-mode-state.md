# 文档模式按钮状态实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让顶部模式按钮使用与当前文档模式一致的图标、文案和高亮状态，并保持默认阅读模式。

**Architecture:** 在共用图标表中提供 `read`（`BookOpenText`）映射，顶部栏仅从 `state.mode` 派生按钮的图标、文案和高亮状态；阅读模式保持普通样式，编辑模式高亮。既有切换动作和编辑权限校验不变。

**Tech Stack:** React 18（浏览器 ESM）、Lucide React、Node `assert` 测试。

## Global Constraints

- 阅读模式的按钮必须显示书本图标和“阅读”。
- 编辑模式的按钮必须显示笔图标和“编辑”。
- `seed.mode` 必须继续为 `"read"`，点击仍通过现有 `toggle-mode` 动作切换。
- 阅读模式切入编辑模式时，必须保留现有编辑权限校验。

---

### Task 1: 为当前模式按钮建立回归测试

**Files:**
- Create: `tests/document-mode-toggle.test.mjs`
- Modify: none

**Interfaces:**
- Consumes: `static/app.js` 中的 `seed`、`handleAction("toggle-mode")` 与 `renderDocumentTopbar`。
- Consumes: `static/library-ui.mjs` 导出的 `icon` 使用的图标表。
- Produces: 对阅读、编辑状态展示及默认模式的静态回归保护。

- [x] **Step 1: Write the failing test**

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
const ui = readFileSync(new URL("../static/library-ui.mjs", import.meta.url), "utf8");
const topbar = app.slice(app.indexOf("function renderDocumentTopbar"), app.indexOf("function renderFolder"));

assert.match(ui, /BookOpenText[\s\S]*read:\s*BookOpenText/);
assert.match(app, /mode:\s*"read"/);
assert.match(topbar, /icon\(state\.mode === "read" \? "read" : "edit"/);
assert.match(topbar, /state\.mode === "read" \? "阅读" : "编辑"/);
assert.match(topbar, /state\.mode === "read" \? "active" : ""/);
assert.match(topbar, /draft\.mode = draft\.mode === "edit" \? "read" : "edit"/);
```

- [x] **Step 2: Run test to verify it fails**

Run: `node tests/document-mode-toggle.test.mjs`

Expected: FAIL because `BookOpenText` and the mode-derived top-bar markup do not exist yet.

- [x] **Step 3: Write minimal implementation**

```js
// static/library-ui.mjs
import { BookOpenText, /* existing imports */ } from "https://esm.sh/lucide-react@0.468.0?external=react";
const icons = { /* existing entries */, read: BookOpenText, edit: PenLine };

// static/app.js renderDocumentTopbar button
className: `ghost-btn document-mode-toggle ${state.mode === "edit" ? "active" : ""}`,
// existing click handler and aria-pressed remain unchanged
}, icon(state.mode === "read" ? "read" : "edit", { size: 16 }), state.mode === "read" ? "阅读" : "编辑"),
```

- [x] **Step 4: Run test to verify it passes**

Run: `node tests/document-mode-toggle.test.mjs`

Expected: PASS with exit code 0.

- [ ] **Step 5: Commit**

```bash
git add static/app.js static/library-ui.mjs tests/document-mode-toggle.test.mjs
git commit -m "fix: reflect current document mode in toggle"
```

### Task 2: Run repository regression checks

**Files:**
- Modify: none
- Test: `tests/*.test.mjs`

**Interfaces:**
- Consumes: the Task 1 implementation and all existing static browser tests.
- Produces: fresh full-suite evidence that the UI adjustment did not regress existing behavior.

- [ ] **Step 1: Run all Node tests**

Run: `Get-ChildItem tests -Filter *.test.mjs | ForEach-Object { node $_.FullName }`

Expected: every test exits 0, including `document-mode-toggle.test.mjs`.

- [ ] **Step 2: Check patch whitespace**

Run: `git diff --check`

Expected: exit code 0 with no whitespace errors.
