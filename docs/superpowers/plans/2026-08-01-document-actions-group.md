# Document Actions Group Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the document header actions as a grouped edit/more control plus a visually dominant publish action.

**Architecture:** Keep action handlers and menu focus behavior unchanged. Add a presentational wrapper around the existing edit and overflow controls in `static/app.js`, then scope new rules to the document toolbar in `static/app.css`.

**Tech Stack:** React-compatible JSX helper code in ES modules, CSS, Node built-in assertion tests.

## Global Constraints

- All actions retain their existing handlers, labels, menu behavior, and publishing state.
- Every action control is 34px high with a 10px radius.
- Secondary controls are a low-contrast grouped surface; publish is the sole blue primary action.
- Keyboard navigation, focus restoration, responsive behavior, and the desktop 64px header rhythm remain intact.

---

### Task 1: Add source-level coverage for the confirmed toolbar structure

**Files:**
- Modify: `tests/library-shell-ui.test.mjs`

**Interfaces:**
- Consumes: `static/app.js` and `static/app.css` source text.
- Produces: assertions for the action-group wrapper and visual rules.

- [ ] **Step 1: Write the failing test**

Add assertions requiring `document-action-group`, 16px edit/more/upload icons, a 34px action group, and a 34px publish button.

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/library-shell-ui.test.mjs`

Expected: failure because the group and upload icon are absent.

### Task 2: Implement the grouped document actions

**Files:**
- Modify: `static/app.js:2723-2737`
- Modify: `static/app.css:378-395`
- Test: `tests/library-shell-ui.test.mjs`

**Interfaces:**
- Consumes: existing `toggle-mode`, `publish`, and `DocumentOverflowMenu` handlers.
- Produces: `.document-action-group`, icon-bearing secondary controls, and an icon-bearing publish button.

- [ ] **Step 1: Wrap the edit and overflow controls**

Render the existing edit button and `DocumentOverflowMenu` within a `document-action-group`, separated by a decorative `document-action-divider`. Preserve their handler and ARIA attributes.

- [ ] **Step 2: Add icons without changing actions**

Prepend `icon("edit", { size: 16 })` to the mode label, retain the existing more icon, and prepend `icon("upload", { size: 16 })` to the idle publish label. The publishing label remains `发表中`.

- [ ] **Step 3: Add scoped styles**

Make the group a 34px translucent, thin-bordered, 10px-radius surface. Make nested secondary controls transparent; add the 1px divider; make the publish control 34px/10px with inline icon spacing; and use a soft-blue active edit state.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/library-shell-ui.test.mjs`

Expected: exit status 0.

### Task 3: Verify the change

**Files:**
- Test: `tests/library-shell-ui.test.mjs`
- Test: `tests/document-visual-layout.test.mjs`
- Test: `tests/document-outline-layout.test.mjs`

**Interfaces:**
- Consumes: final document action markup and CSS.
- Produces: verification that header styling and existing layout behavior remain valid.

- [ ] **Step 1: Run related layout tests**

Run: `node tests/document-visual-layout.test.mjs; node tests/document-outline-layout.test.mjs`

Expected: both processes exit with status 0.

- [ ] **Step 2: Run all Node tests and check the patch**

Run: `Get-ChildItem tests -Filter '*.test.mjs' | ForEach-Object { node $_.FullName }; git diff --check -- static/app.js static/app.css tests/library-shell-ui.test.mjs`

Expected: every test exits with status 0 and the diff check produces no output.
