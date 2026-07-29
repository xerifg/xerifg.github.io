# Table Color Toolbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Feishu-like text color and cell background color panels to the selected table-cell floating toolbar.

**Architecture:** Keep the implementation inside the existing Tiptap editor module. Reuse the document color palette interaction pattern, route text color to Tiptap color marks, and route cell background color to the existing table cell `backgroundColor` attribute.

**Tech Stack:** React via CDN, Tiptap 2.11.7, plain CSS, Node source-level integration tests.

## Global Constraints

- Do not add new editor dependencies.
- Keep table formatting inside existing Tiptap marks and table cell attributes.
- Keep the normal selected-text bubble hidden for table selections.
- Preserve existing compact table toolbar actions.

---

### Task 1: Add Failing Integration Coverage

**Files:**
- Modify: `tests/table-editor-integration.test.mjs`

**Interfaces:**
- Consumes: `tableControlsSource`, `appSource`, and `cssSource` source slices already defined in the test.
- Produces: Assertions that fail until the table toolbar has text color and cell background color panels.

- [ ] **Step 1: Write the failing test assertions**

```js
assert.match(tableControlsSource, /openToolbarMenu\(event, "textColor"\)/, "table toolbar should expose the document-style text color panel");
assert.match(tableControlsSource, /openToolbarMenu\(event, "cellBackground"\)/, "table toolbar should expose a cell background color panel");
assert.match(tableControlsSource, /单元格背景颜色|\\u5355\\u5143\\u683c\\u80cc\\u666f\\u989c\\u8272/, "cell background panel should be labeled for cell background color");
assert.match(appSource, /if \(command === "background-reset"\) return chain\.setCellAttribute\("backgroundColor", null\)\.run\(\);/, "table background reset should clear the cell background attribute");
assert.match(cssSource, /\.table-toolbar-color-panel/, "table color popovers should use table-specific color panel placement");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/table-editor-integration.test.mjs`
Expected: FAIL because the table toolbar does not yet expose `textColor`, `cellBackground`, or `background-reset`.

### Task 2: Implement Table Color Panels

**Files:**
- Modify: `static/app.js`
- Modify: `static/app.css`

**Interfaces:**
- Consumes: `applyTableCommand(editor, command)`, `openToolbarMenu(event, type)`, and existing `feishu-color-panel` CSS.
- Produces: Table toolbar text color and cell background color controls.

- [ ] **Step 1: Add background reset command**

```js
if (command === "background-reset") return chain.setCellAttribute("backgroundColor", null).run();
```

- [ ] **Step 2: Add table color palettes**

Add the same text color list and background color list used by `FeishuBubbleToolbar` inside `FeishuTableControls`, then render a `feishu-color-panel table-toolbar-color-panel` when the active menu is `textColor` or `cellBackground`.

- [ ] **Step 3: Replace the old highlight-only trigger**

Replace the old `table-highlight-trigger` button and three-item highlight menu with two triggers:

```js
openToolbarMenu(event, "textColor")
openToolbarMenu(event, "cellBackground")
```

- [ ] **Step 4: Add table color panel CSS**

```css
.table-toolbar-color-panel {
  left: auto;
  top: calc(100% + 6px);
}

.table-selection-toolbar .table-cell-background-trigger {
  color: #2f6f3e;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node tests/table-editor-integration.test.mjs`
Expected: PASS.

### Task 3: Verify Existing Test Suite

**Files:**
- No code changes.

**Interfaces:**
- Consumes: all existing `tests/*.mjs`.
- Produces: confidence that the toolbar source changes did not break existing checks.

- [ ] **Step 1: Run all tests**

Run: `Get-ChildItem tests -Filter *.mjs | ForEach-Object { node $_.FullName }`
Expected: every test exits with code 0.
