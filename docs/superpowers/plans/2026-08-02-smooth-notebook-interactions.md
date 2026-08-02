# Smooth Notebook Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the notebook's existing directory, document, editor, and overlay interactions feel immediate and consistent without changing the three-column layout or stored data shape.

**Architecture:** Keep durable data and actions in `static/app.js`; add small pure helpers for transient feedback state so they can be source-tested without a browser. Reuse the existing tree drag model, document outline observer, BubbleMenu, modal shell, and preference system; CSS owns timing, elevation, and reduced-motion behavior.

**Tech Stack:** Browser ES modules, React 18, existing Tiptap/BlockNote editor integration, CSS, Node assertion tests.

## Global Constraints

- Preserve note/folder data, the existing desktop layout, and current keyboard behavior.
- Motion must be 120-220 ms and obey `prefers-reduced-motion: reduce`.
- New dialogs and command palette must use focus movement, Escape close, and an accessible live announcement.
- No remote retry queue: only report and retain browser-local persistence failures.

---

### Task 1: Add a reusable transient-feedback model and toast host

**Files:**
- Create: `static/interaction-feedback.mjs`
- Create: `tests/interaction-feedback.test.mjs`
- Modify: `static/app.js`
- Modify: `static/app.css`

**Interfaces:**
- Produces `createNotice(id, message, tone = "success")`, `pushNotice(queue, notice, limit = 3)`, and `dismissNotice(queue, id)`.
- Consumes `noticeQueue` and `handleAction("dismiss-notice", id)` in the application shell.

- [ ] **Step 1: Write failing pure-model tests**

```js
import assert from "node:assert/strict";
import { createNotice, dismissNotice, pushNotice } from "../static/interaction-feedback.mjs";

const saved = createNotice("saved", "已保存");
assert.deepEqual(saved, { id: "saved", message: "已保存", tone: "success" });
assert.deepEqual(pushNotice([saved], createNotice("moved", "已移动"), 1).map((item) => item.id), ["moved"]);
assert.deepEqual(dismissNotice([saved], "saved"), []);
```

- [ ] **Step 2: Run the new test and verify it fails because the module is absent**

Run: `node tests/interaction-feedback.test.mjs`

- [ ] **Step 3: Add the minimal pure helper module**

```js
export function createNotice(id, message, tone = "success") { return { id, message, tone }; }
export function pushNotice(queue, notice, limit = 3) { return [...queue.filter((item) => item.id !== notice.id), notice].slice(-limit); }
export function dismissNotice(queue, id) { return queue.filter((item) => item.id !== id); }
```

- [ ] **Step 4: Render the live toast host from application state and route dismiss actions**

```js
h("div", { className: "toast-host", "aria-live": "polite", "aria-atomic": "true" },
  state.noticeQueue.map((notice) => h("div", { className: `toast toast-${notice.tone}`, key: notice.id },
    h("span", null, notice.message),
    h("button", { type: "button", "aria-label": "关闭提示", onClick: () => handleAction("dismiss-notice", notice.id) }, "×")
  ))
)
```

- [ ] **Step 5: Add shared toast motion and reduced-motion rules**

```css
.toast { animation: overlay-enter 160ms var(--interaction-ease); }
@media (prefers-reduced-motion: reduce) { .toast { animation: none; } }
```

- [ ] **Step 6: Run tests and commit**

Run: `node tests/interaction-feedback.test.mjs`

Commit: `git add static/interaction-feedback.mjs tests/interaction-feedback.test.mjs static/app.js static/app.css && git commit -m "feat: add notebook interaction feedback"`

### Task 2: Make directory, document switching, and dragging visibly responsive

**Files:**
- Create: `tests/smooth-navigation-ui.test.mjs`
- Modify: `static/app.js`
- Modify: `static/app.css`

**Interfaces:**
- Consumes the existing `treeDrag`, `dragTarget`, `select-note`, and outline observer state.
- Produces `document-switching` and `is-dragging` visual states without changing note selection or drag/drop outcomes.

- [ ] **Step 1: Write source contracts for directory and document interaction state**

```js
assert.match(app, /className: `tree-note[\s\S]*is-dragging/);
assert.match(css, /\.tree-folder-children[\s\S]*transition:/);
assert.match(css, /\.document-paper\.is-switching[\s\S]*animation:/);
assert.match(css, /\.tree-note\.drop-before::before[\s\S]*animation:/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.document-paper\.is-switching/);
```

- [ ] **Step 2: Run the test and verify it fails on the missing transition contracts**

Run: `node tests/smooth-navigation-ui.test.mjs`

- [ ] **Step 3: Add transient switching state around note selection, without delaying selection**

```js
const [isDocumentSwitching, setIsDocumentSwitching] = useState(false);
const selectNoteWithTransition = (id) => {
  setIsDocumentSwitching(true);
  selectNote(id);
  window.setTimeout(() => setIsDocumentSwitching(false), 180);
};
```

- [ ] **Step 4: Add CSS-only folder, row, drag-preview, insertion-line, and paper transitions**

```css
:root { --interaction-ease: cubic-bezier(.2,.8,.2,1); }
.tree-folder-children { transform-origin: top; transition: grid-template-rows 180ms var(--interaction-ease), opacity 140ms ease; }
.tree-note.is-dragging { opacity: .5; transform: scale(.985); }
.tree-note.drop-before::before, .tree-note.drop-after::after { animation: drop-target-pulse 160ms var(--interaction-ease); }
.document-paper.is-switching { animation: document-switch-in 180ms var(--interaction-ease); }
```

- [ ] **Step 5: Verify the existing outline observer remains the sole active-heading source and run tests**

Run: `node tests/smooth-navigation-ui.test.mjs && node tests/document-outline-layout.test.mjs`

- [ ] **Step 6: Commit**

Commit: `git add static/app.js static/app.css tests/smooth-navigation-ui.test.mjs && git commit -m "feat: polish notebook navigation feedback"`

### Task 3: Add save-state feedback and a keyboard-accessible command palette

**Files:**
- Create: `static/command-palette.mjs`
- Create: `tests/command-palette.test.mjs`
- Modify: `static/app.js`
- Modify: `static/app.css`

**Interfaces:**
- Produces `buildCommandItems(state)` and `filterCommandItems(items, query)`.
- Consumes existing action names for search, create note/folder, view navigation, and settings.
- Adds `state.commandPaletteOpen` and `state.commandQuery`; `Ctrl/Cmd+K` toggles the palette.

- [ ] **Step 1: Write failing command data tests**

```js
import assert from "node:assert/strict";
import { filterCommandItems } from "../static/command-palette.mjs";
const items = [{ id: "new-note", label: "新建笔记" }, { id: "settings", label: "打开设置" }];
assert.deepEqual(filterCommandItems(items, "设置").map((item) => item.id), ["settings"]);
```

- [ ] **Step 2: Run and verify failure**

Run: `node tests/command-palette.test.mjs`

- [ ] **Step 3: Implement query filtering and stable command IDs**

```js
export function filterCommandItems(items, query) {
  const normalized = String(query || "").trim().toLocaleLowerCase("zh-CN");
  return normalized ? items.filter((item) => item.label.toLocaleLowerCase("zh-CN").includes(normalized)) : items;
}
```

- [ ] **Step 4: Render focus-managed palette and keyboard handler, reusing existing modal focus patterns**

```js
if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
  event.preventDefault();
  handleAction("toggle-command-palette");
}
```

- [ ] **Step 5: Bind editor persistence to explicit `saving`, `saved`, and `error` status display**

```js
setSaveState("saving");
persistDraft(nextState).then(() => setSaveState("saved")).catch(() => setSaveState("error"));
```

- [ ] **Step 6: Add overlay shared animation/focus styles and run tests**

Run: `node tests/command-palette.test.mjs && node tests/library-shell-ui.test.mjs`

- [ ] **Step 7: Commit**

Commit: `git add static/command-palette.mjs tests/command-palette.test.mjs static/app.js static/app.css && git commit -m "feat: add command palette and save feedback"`

### Task 4: Unify floating controls, confirmations, and editor affordances

**Files:**
- Create: `tests/overlay-interactions.test.mjs`
- Modify: `static/app.js`
- Modify: `static/app.css`

**Interfaces:**
- Consumes existing BubbleMenu, table toolbar, overflow menu, modal shell, and settings controls.
- Produces shared `.interaction-overlay` and `.interaction-sheet` motion/elevation contracts, plus reusable confirmation calls through `modalShell`.

- [ ] **Step 1: Write failing contracts for shared overlay behavior**

```js
assert.match(css, /\.interaction-overlay[\s\S]*animation: overlay-enter/);
assert.match(css, /\.interaction-sheet[\s\S]*animation: sheet-enter/);
assert.match(app, /event\.key === "Escape"/);
assert.match(app, /previousFocus.*focus\(\)/s);
assert.match(app, /"aria-live": "polite"/);
```

- [ ] **Step 2: Run and verify failure**

Run: `node tests/overlay-interactions.test.mjs`

- [ ] **Step 3: Apply shared classes to BubbleMenu, document overflow, table popovers, and settings sheet**

```js
className: "interaction-overlay document-overflow-menu"
className: "interaction-overlay table-toolbar-popover"
className: "interaction-sheet settings-sheet"
```

- [ ] **Step 4: Route destructive note actions through the existing modal shell and announce complete actions through Task 1's toast queue**

```js
return modalShell("删除笔记？", "删除后可从回收站恢复。", null, "删除", "confirm-delete-note", handleAction, { danger: true });
```

- [ ] **Step 5: Preserve pointer-down selection for existing selected-text/table controls and add active/focus states**

```css
.toolbar-button:active, .mini-action:active { transform: scale(.96); }
.interaction-overlay :focus-visible { outline: 3px solid rgba(0,122,255,.25); outline-offset: 2px; }
```

- [ ] **Step 6: Run focused tests, full suite, syntax checks, and browser smoke tests**

Run: `node tests/overlay-interactions.test.mjs; Get-ChildItem tests/*.test.mjs | ForEach-Object { node $_.FullName }; node --check static/app.js; node --check static/library-ui.mjs; git diff --check`

- [ ] **Step 7: Commit**

Commit: `git add static/app.js static/app.css tests/overlay-interactions.test.mjs && git commit -m "feat: unify notebook overlay interactions"`

## Plan Self-Review

- Coverage: Tasks 1-4 cover all approved directory, editor, navigation, overlay, feedback, and accessibility requirements. Remote synchronization is intentionally excluded by the specification.
- Consistency: transient feedback stays in its own module; command filtering stays in its own module; durable note operations remain in `app.js`.
- Scope: each task is independently testable and does not change the notebook's data schema or layout.
