# Table Hover Highlight Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop edit-mode pointer hover from tinting an entire table while preserving hover feedback on other top-level editor blocks.

**Architecture:** Keep the existing generic block-hover rule but narrow its CSS selector so Tiptap's top-level `.tableWrapper` is excluded. Protect the behavior with the existing table editor integration test before changing production CSS.

**Tech Stack:** CSS, Node.js `node:assert`, Tiptap/ProseMirror integration source tests

## Global Constraints

- Do not change Tiptap cell selection behavior.
- Do not change explicit row or column selection highlighting.
- Do not change table-control mouse handling.
- Preserve the existing hover feedback for non-table top-level editor blocks.

---

### Task 1: Exclude Tables From Generic Block Hover

**Files:**
- Modify: `tests/table-editor-integration.test.mjs`
- Modify: `static/app.css:646`

**Interfaces:**
- Consumes: Tiptap's top-level `.tableWrapper` DOM class and the existing `.feishu-editor` editor class.
- Produces: A generic hover selector that applies to direct editor children except `.tableWrapper`.

- [ ] **Step 1: Write the failing regression test**

Add this assertion beside the existing table wrapper CSS assertions:

```js
assert.match(
  cssSource,
  /\.feishu-editor\s*>\s*\*:not\(\.tableWrapper\):hover\s*\{[^}]*background:\s*rgba\(36,\s*104,\s*242,\s*\.08\)/,
  "hovering a table wrapper should not apply the generic editor block highlight"
);
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
node tests/table-editor-integration.test.mjs
```

Expected: FAIL with `hovering a table wrapper should not apply the generic editor block highlight` because the selector is still `.feishu-editor > *:hover`.

- [ ] **Step 3: Implement the minimal CSS change**

Replace the selector while preserving its declaration:

```css
.feishu-editor > *:not(.tableWrapper):hover {
  background: rgba(36, 104, 242, .08);
}
```

- [ ] **Step 4: Run focused verification**

Run:

```powershell
node tests/table-editor-integration.test.mjs
node tests/table-model.test.mjs
```

Expected: both commands PASS.

- [ ] **Step 5: Run whitespace verification**

Run:

```powershell
git diff --check
```

Expected: no whitespace errors. Existing Windows line-ending warnings are acceptable.

- [ ] **Step 6: Commit the implementation when requested**

```powershell
git add static/app.css tests/table-editor-integration.test.mjs
git commit -m "fix: prevent full table hover highlight"
```
