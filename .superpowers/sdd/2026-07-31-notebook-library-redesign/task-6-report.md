# Task 6 report

## status

DONE_WITH_CONCERNS.

The publish review sheet, safe publish lifecycle, focused tests, and complete regression verification are finished. The only concern is the Windows split-root `view_image` failure documented below; no Task 7 global responsive work was added.

## summary

Replaced the old generic centered publish modal with a dedicated Apple-like review sheet that opens from the shell's upper-right region. The sheet shows the GitHub repository and branch, connection status, selected change count, the current change list, public tags derived from selected note changes, expandable publish diffs, the local-draft retention note, and explicit Cancel / Confirm Publish actions.

The existing GitHub authentication, remote loading, publish change-set, diff, validation, selection, merge, document/index writes, remote deletion, draft reconciliation, and delete-draft flows remain in place. Publishing no longer closes the review before network work finishes. Only the confirmation action becomes unavailable while publishing; success closes the sheet only after all GitHub writes complete and shows `已发表到 GitHub`, while failure leaves the sheet, selected IDs, drafts, and an inline alert available for retry or closure.

## visual grounding

Read the Task 6 brief, full implementation plan, full specification, and Task 5 report. The exact `reference-publish-task6.png` and the SDD `reference-publish.png` are byte-identical. Direct `view_image` calls against the main root and the separate visualization writable root were both rejected before decode because the Windows unelevated sandbox cannot enforce split writable-root sets. The implementation therefore follows the written approved sheet specification: upper-right origin, 18px frosted/solid material, one sheet shadow, dim backdrop, concise hierarchy, and 220ms damped scale/fade with a reduced-motion opacity-only path. The SDD reference was not deleted; the parent owns cleanup of its main-root reference copy.

## RED / GREEN

### publish sheet contract

- RED: replaced the stale `查看差异` modal assertion with contracts for `publish-sheet`, destination repository/branch labels, `本次变更`, dynamic `公开标签`, `查看发布差异`, local-draft retention copy, sheet footer, `确认发表`, dialog semantics, accessible close/focus lifecycle, inline error feedback, success timing, top-right transform origin, 18px material, and reduced-motion behavior.
- RED evidence: `node tests/publish-review-diff-ui.test.mjs` exited 1 first on missing `className: "publish-sheet"`.
- Baseline guard: `node tests/publish-model.test.mjs` exited 0 during RED, confirming the existing publish model remained intact.
- GREEN: implemented `PublishReviewSheet`, controlled selection state, selected-note public tags, safe publish lifecycle, focus entry/trap/restore, Escape/backdrop/button closure, material, motion, and inline failure feedback.
- Test correction: the first close-control regex accepted only an unquoted object property, while the valid React source uses `"aria-label"`; it was corrected to accept quoted or unquoted JavaScript property syntax without changing production code.

## tests

Focused:

- `node tests/publish-review-diff-ui.test.mjs` — pass.
- `node tests/publish-model.test.mjs` — pass.

Full verification:

- Full `tests/*.test.mjs` sweep — 12 passed, 0 failed.
- `node --check static/app.js` — pass.
- `node --check static/library-ui.mjs` — pass.
- `node --check static/library-ui-model.mjs` — pass.
- `git diff --check` — pass, no whitespace errors.

## commit

- Planned/final message: `feat: redesign publish review sheet`.
- Base commit: `35e2898`.
- Exact resulting commit hash is reported in the worker handoff because a commit cannot contain its own hash.

## files

- `static/app.js` — adds the dedicated review sheet and accessible focus lifecycle; derives selected public tags; keeps modal context and selected IDs during publish; closes only after real GitHub success; leaves failures inline.
- `static/app.css` — replaces generic publish-modal styling with the upper-right 18px sheet material, one shadow, dim backdrop, selected rows, public tag chips, footer, 220ms motion, solid-material preference, and reduced-motion cross-fade.
- `tests/publish-review-diff-ui.test.mjs` — updates the publish UI, safety, accessibility, and motion contracts.
- `.superpowers/sdd/2026-07-31-notebook-library-redesign/task-6-report.md` — records TDD evidence, verification, scope review, and concern.

## self-review

- Confirmed `buildPublishChangeSet`, `buildPublishChangeDetails`, `validatePublishSelection`, `mergeSelectedPublishState`, `assignSelectedPublishFiles`, and `reconcilePublishedNotes` remain the publishing source of truth.
- Confirmed checkbox `data-publish-change-id` IDs and all existing change kinds remain intact.
- Confirmed public tags update from the currently selected note changes and disappear when no selected note contributes a public tag.
- Confirmed authentication and publish-tag collection still precede review construction.
- Confirmed publish failure never fabricates success, never clears the modal context, and never reconciles local notes as published.
- Confirmed publish success closes the sheet and emits success feedback only after document, deletion, and index GitHub operations complete.
- Confirmed close button, Cancel, backdrop, and Escape stay usable while the confirm button alone reports/disables for in-flight publishing.
- Confirmed initial focus enters the sheet, Tab is contained, and unmount restores the previous trigger focus.
- Confirmed delete-draft, document deletion, local persistence, note JSON, GitHub API, and cache-version behavior are unchanged.
- Confirmed no global responsive shell changes from Task 7 were introduced; the existing narrow diff-column rule was retained.

## concerns

- `view_image` could not decode the exact reference because the Windows split-root sandbox failed before the image tool opened either copy. This is tooling-only; both reference files remain untouched and their byte identity was verified by file metadata/source handling.
- Browser screenshot QA remains outside Task 6 and is reserved for Task 7; automated source/model/syntax regression coverage is green.