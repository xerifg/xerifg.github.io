# Proportional Notebook Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the notebook shell visually proportional across desktop canvas widths while allowing the reading column to be configured as a canvas percentage.

**Architecture:** Use viewport percentages for the primary rail, notebook sidebar, and document outline so their relative size scales with the canvas. Keep the existing user preference as the reading-column width control, expanding only its maximum valid value and slider maximum to 1080px.

**Tech Stack:** CSS Grid, CSS custom properties, React, Node.js assertion tests.

## Global Constraints

- Desktop shell uses a stable 56px primary icon rail, then a 14% directory sidebar, a flexible document canvas, and a 12vw outline.
- The document outline must remain fixed beneath the 64px top bar on desktop.
- The configurable document width remains constrained to 640–1080px.

---

### Task 1: Lock in proportional layout expectations

**Files:**
- Modify: `tests/document-visual-layout.test.mjs`
- Modify: `tests/document-outline-layout.test.mjs`
- Modify: `tests/library-ui-model.test.mjs`

**Interfaces:**
- Consumes: rendered CSS and `normalizeUiPreferences()`.
- Produces: regression checks for percentage shell rails, percentage outline width, and the 1080px preference cap.

- [ ] **Step 1: Write failing tests**

```js
assert.match(css, /grid-template-columns:\s*4% 14% minmax\(0, 1fr\)/);
assert.match(desktopPolish, /grid-template-columns:\s*minmax\(0, 1fr\) 12vw/);
assert.deepEqual(normalizeUiPreferences({ contentWidth: 1200 }), { ...DEFAULT_UI_PREFERENCES, contentWidth: 1080 });
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `node tests/document-visual-layout.test.mjs; node tests/document-outline-layout.test.mjs; node tests/library-ui-model.test.mjs`

Expected: FAIL because CSS still contains fixed `210px` rails and preferences clamp at `920`.

- [ ] **Step 3: Implement the smallest compatible layout change**

```css
.app-shell { grid-template-columns: 4% 14% minmax(0, 1fr); }
@media (min-width: 1101px) {
  .document-workspace { grid-template-columns: minmax(0, 1fr) 12vw; }
  .document-outline { width: 12vw; }
}
```

Remove the outline's fixed inline width and raise preference normalisation and the range input maximum to `1080`.

- [ ] **Step 4: Run the focused tests and verify they pass**

Run: `node tests/document-visual-layout.test.mjs; node tests/document-outline-layout.test.mjs; node tests/library-ui-model.test.mjs`

Expected: all commands exit with status 0.

### Task 2: Run the repository regression suite

**Files:**
- Verify: `tests/*.test.mjs`

**Interfaces:**
- Consumes: completed proportional layout CSS and preference model.
- Produces: evidence that existing notebook behavior still passes.

- [ ] **Step 1: Run the complete test suite**

Run: `Get-ChildItem tests -Filter '*.test.mjs' | ForEach-Object { node $_.FullName }`

Expected: every test file exits with status 0.
