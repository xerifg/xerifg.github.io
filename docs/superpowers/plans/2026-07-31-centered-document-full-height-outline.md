# Centered Document and Full-Height Outline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Center the document independently and place a 210 px, full-height outline at the far-right edge on desktop.

**Architecture:** Keep `DocumentPaper` and `DocumentOutline` intact, update the shared outline width constant, and use responsive CSS grid modes. Medium desktop reserves a dedicated outline column; wide desktop overlays the end-aligned outline and independently centered paper in one grid area.

**Tech Stack:** React without JSX, CSS Grid/sticky positioning, Node assertion tests.

## Global Constraints

- Preserve the dirty main worktree and do not include unrelated changes in any commit.
- Keep reader/editor, publishing, themes, stored data, and the existing 1100 px outline-hide breakpoint unchanged.
- Use a 210 px outline, a 64 px top bar offset, and a 1600 px wide-layout breakpoint.
- Do not widen body text or add a new right-side panel.

---

### Task 1: Lock the responsive geometry with failing contracts

**Files:**
- Modify: `tests/document-visual-layout.test.mjs`
- Test: `tests/document-visual-layout.test.mjs`

**Interfaces:**
- Consumes: `static/app.css` and `static/app.js` as UTF-8 source strings.
- Produces: source contracts for `documentOutlinePanelWidth`, medium desktop grid, wide desktop overlay, paper centering, full-height outline, and empty-outline behavior.

- [x] **Step 1: Add the failing assertions**

```js
assert.match(app, /const documentOutlinePanelWidth = 210;/);
assert.match(layoutCss, /grid-template-columns:\s*minmax\(0,\s*1fr\) 210px/);
assert.match(layoutCss, /\.paper\s*\{[^}]*justify-self:\s*center/s);
assert.match(layoutCss, /\.document-outline\s*\{[^}]*height:\s*calc\(100vh - 64px\)[^}]*max-height:\s*none/s);
assert.match(layoutCss, /@media \(min-width:\s*1600px\)[\s\S]*grid-template-columns:\s*1fr/);
assert.match(layoutCss, /\.document-workspace\.has-empty-outline[^{]*\{[^}]*grid-template-columns:\s*1fr/s);
```

- [x] **Step 2: Run the target test and verify RED**

Run: `node tests/document-visual-layout.test.mjs`

Expected: FAIL because the current constant is 196, the workspace is left-aligned and tightly sized, and the outline height is capped.

### Task 2: Implement the centered paper and right-edge outline

**Files:**
- Modify: `static/app.js`
- Modify: `static/app.css`
- Test: `tests/document-visual-layout.test.mjs`

**Interfaces:**
- Consumes: `documentOutlinePanelWidth` in `DocumentOutline` and existing workspace state classes (`has-outline`, `has-empty-outline`, `without-outline`).
- Produces: a 210 px inline outline width and three layout modes: medium desktop, wide desktop, and outline-free.

- [x] **Step 1: Update the shared width constant**

```js
const documentOutlinePanelWidth = 210;
```

- [x] **Step 2: Replace the desktop workspace overrides**

```css
@media (min-width: 1101px) {
  .paper-scroll { padding: 0 0 52px; }
  .document-workspace {
    width: 100%;
    margin: 0;
    grid-template-columns: minmax(0, 1fr) 210px;
    gap: 24px;
    justify-content: stretch;
  }
  .paper { justify-self: center; }
  .document-outline {
    width: 210px;
    justify-self: end;
    top: 0;
    height: calc(100vh - 64px);
    max-height: none;
  }
  .document-workspace.without-outline,
  .document-workspace.has-empty-outline { grid-template-columns: 1fr; }
  .document-workspace.has-empty-outline .document-outline { display: none; }
}

@media (min-width: 1600px) {
  .document-workspace.has-outline { grid-template-columns: 1fr; }
  .document-workspace.has-outline > .paper,
  .document-workspace.has-outline > .document-outline {
    grid-column: 1;
    grid-row: 1;
  }
}
```

- [x] **Step 3: Run the target test and verify GREEN**

Run: `node tests/document-visual-layout.test.mjs`

Expected: PASS.

- [x] **Step 4: Run the existing outline regression**

Run: `node tests/document-outline-layout.test.mjs`

Expected: PASS after updating any width assertion from 196 to 210 where the assertion describes the new layout contract.

### Task 3: Verify responsive and visual behavior

**Files:**
- Modify only if a regression is found: `static/app.css`, `static/app.js`, `tests/document-visual-layout.test.mjs`
- Update: `design-qa.md`

**Interfaces:**
- Consumes: the completed layout and local browser preview.
- Produces: fresh automated and screenshot evidence.

- [x] **Step 1: Run the complete local verification suite**

Run all `tests/*.test.mjs`, then:

```powershell
node --check static/app.js
node --check static/library-ui.mjs
node --check static/library-ui-model.mjs
git diff --check
```

Expected: all test files pass, all syntax checks exit 0, and diff-check exits 0.

- [x] **Step 2: Verify desktop states in the in-app browser**

Check 2048 x 1024: paper centered in the full content area, outline right-aligned and full height.

Check 1488 x 1058: paper centered inside the safe column, outline in its 210 px column with no overlap.

Check 1100 px: outline hidden under the existing breakpoint.

- [x] **Step 3: Verify long and short outlines**

Confirm a short outline still shows a divider from below the top bar to the viewport bottom. Confirm a long outline scrolls internally without moving or covering the paper.

- [x] **Step 4: Record final evidence**

Update `design-qa.md` with viewport measurements, screenshot paths, console status, responsive results, and the exact final test count.
