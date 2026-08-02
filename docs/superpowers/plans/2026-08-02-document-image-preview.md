# Document Image Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add smooth click-to-preview behavior for images in both document reading and editing modes.

**Architecture:** Keep behavior local to `DocumentPaper`, passing an image-click callback into `TiptapEditor` and using a React overlay component for preview rendering. CSS handles the visual treatment and transitions with source-rectangle variables.

**Tech Stack:** React 18 via ESM, Tiptap/ProseMirror, static CSS, Node source-level regression tests.

## Global Constraints

- Do not modify document HTML when opening or closing the preview.
- Support reading mode `.tiptap-reader img` and editing mode `.feishu-editor img`.
- Close with backdrop click, close button, or `Escape`.
- Keep the change dependency-free.

---

### Task 1: Preview Wiring

**Files:**
- Modify: `static/app.js`
- Modify: `static/app.css`
- Test: `tests/document-image-preview.test.mjs`

**Interfaces:**
- Consumes: `DocumentPaper({ note, state, editable, updateNote, handleAction })`
- Produces: `DocumentImagePreview({ preview, onClose })` and `TiptapEditor({ note, onChange, onAssetInserted, onImagePreview })`

- [ ] **Step 1: Write the failing test**

Create `tests/document-image-preview.test.mjs` with assertions for `DocumentImagePreview`, `onImagePreview`, reader `onClick`, editor `handleClick`, and `.image-preview-backdrop` CSS.

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/document-image-preview.test.mjs`
Expected: FAIL because the preview code is not present yet.

- [ ] **Step 3: Write minimal implementation**

Add image click handling in `DocumentPaper`, pass it into `TiptapEditor`, add an editor `handleClick`, render `DocumentImagePreview`, and add overlay CSS.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/document-image-preview.test.mjs`
Expected: PASS.

- [ ] **Step 5: Run focused regression tests**

Run: `node tests/document-image-preview.test.mjs; node tests/draft-image-persistence.test.mjs; node tests/document-mode-toggle.test.mjs`
Expected: all exit 0.
