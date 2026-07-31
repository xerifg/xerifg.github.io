# Final Binding Fixes Report

## Scope

Resolved final-review Findings 2–6 without changing the real selective GitHub publish implementation.

## TDD evidence

- Added `tests/final-binding-fixes.test.mjs` before production changes.
- First focused RED: `node tests/final-binding-fixes.test.mjs` failed because `applyLocalTagMutation` was absent.
- After the model implementation, the same test advanced to the expected missing `recent` UI contract, then modal/theme/icon contracts.
- Final focused and full-suite runs are green.

## Implemented behavior

- Tag create/rename now use local tags-on-notes mutations, remain in `tags`, select the resulting tag, mark affected notes dirty, and never open publish review.
- “New Tag” is disabled with an inline explanation when there is no active note to attach it to.
- Publish tag selection no longer provides create/rename controls. Tag deletion remains in that explicit flow and continues through publish review/change dependency validation.
- Added `recent` in the segmented control, model, and tag return context.
- Deterministic recent rule: a tag inherits the latest valid `note.date` among notes that contain it; equal timestamps use the later tag occurrence in note/tag traversal order, then `zh-CN` name order. Invalid/missing dates sort last. Local create appends the new tag; local rename moves the renamed tag to the end of each affected note and timestamps affected notes, so both appear first predictably.
- Added theme surface tokens for page, raised, subtle, control, hover, selected, rail, and sidebar surfaces in light, dark, and system-dark modes. Applied them to home summary, tag browser/detail, settings, modal, document/editor, and publish-adjacent surfaces/foregrounds.
- Ordinary `modalShell` dialogs now expose dialog semantics, an accessible title, initial focus, Escape close, Tab/Shift+Tab containment, backdrop close, and focus restoration. The contract covers auth, naming, renaming, local tag, and publish-tag dialogs.
- Tree disclosure, add, and overflow glyphs now use the shared pinned Lucide adapter with matching chevron/plus/ellipsis semantics.

## Verification

- Full Node test suite: 14 test files passed.
- `node --check static/app.js`: passed.
- `node --check static/library-ui.mjs`: passed.
- `node --check static/library-ui-model.mjs`: passed.
- `git diff --check`: passed.

## Remaining verification boundary

No browser/pixel-level visual claim is made here. Parent QA should reload the application and visually verify light, explicit dark, and system-dark home/tags/settings/editor/publish states plus focus behavior.
