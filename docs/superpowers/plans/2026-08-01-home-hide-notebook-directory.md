# 首页隐藏知识库目录 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在首页隐藏知识库目录，且保留笔记页的目录及其窄屏开关。

**Architecture:** 在 `App` 的壳层 JSX 中把目录区域及目录开关共同限制为 `state.view === "library"`。不改变目录组件、导航模型或样式；源码结构测试锁定这个渲染边界。

**Tech Stack:** 原生 ES modules、React、Node.js 内置 `assert` 测试。

## Global Constraints

- 只更改应用壳层和现有壳层测试。
- 不更改目录数据、持久化逻辑、导航模型或 CSS。
- 先运行新增测试并确认它因缺少条件渲染而失败，再修改生产代码。

---

### Task 1: 限制知识库目录的渲染视图

**Files:**
- Modify: `tests/library-shell-ui.test.mjs`
- Modify: `static/app.js:1304-1337`

**Interfaces:**
- Consumes: `state.view` 的现有主视图字符串；笔记视图值为 `"library"`。
- Produces: 首页、标签和设置视图不生成知识库目录或目录开关；笔记视图仍生成两者。

- [ ] **Step 1: Write the failing test**

在 `tests/library-shell-ui.test.mjs` 的目录开关断言旁新增：

```js
const appShellSource = app.slice(app.indexOf('return h(React.Fragment'), app.indexOf('function PaperScroll'));
assert.match(
  appShellSource,
  /state\.view\s*===\s*"library"\s*\?\s*renderContextSidebar\(/s,
  "the notebook directory should render only in the Notes view"
);
assert.match(
  appShellSource,
  /state\.view\s*===\s*"library"\s*\?\s*h\("button",\s*\{[^}]*className:\s*"context-sidebar-toggle"/s,
  "the directory drawer toggle should render only in the Notes view"
);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/library-shell-ui.test.mjs`

Expected: FAIL because `renderContextSidebar` and the directory toggle are currently unconditionally rendered outside the settings branch.

- [ ] **Step 3: Write minimal implementation**

In the `App` shell, make the non-settings sidebar branch render `renderContextSidebar(...)` only when `state.view === "library"`; otherwise return `null`. Wrap the existing `context-sidebar-toggle` button in the same `state.view === "library"` conditional.

```js
state.view === "settings"
  ? h(/* existing settings sidebar */)
  : state.view === "library"
    ? renderContextSidebar(/* existing arguments */)
    : null,

state.view === "library"
  ? h("button", { className: "context-sidebar-toggle" /* existing props */ }, /* existing children */)
  : null,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/library-shell-ui.test.mjs`

Expected: PASS with exit code 0.

- [ ] **Step 5: Run the full test suite**

Run: `Get-ChildItem tests -Filter *.test.mjs | ForEach-Object { node $_.FullName }`

Expected: every test exits successfully.
