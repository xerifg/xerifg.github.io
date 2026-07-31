# Task 5 report

## status

DONE_WITH_CONCERNS.

The editor implementation and automated verification are complete. The concern is limited to the Windows split-root image tool failure documented below; the selected reference was still inspected through a read-only downsampled Base64 rendering before implementation.

## summary

Refined the reading and editing workspace while preserving the Library Rail, context tree, Tiptap editor, table/math/attachment extensions, local drafts, authentication, and selective publishing behavior.

The document top bar now uses a quiet hairline layout: folder/document breadcrumb on the left, explicit automatic-save status in the center, and read/edit, accessible overflow, and publish controls on the right. Rename, local-draft deletion, and document deletion now live in the overflow menu; publish remains disabled during publishing.

The document now renders before an optional 196px right-side outline. Outline extraction and scroll-linked active-heading behavior remain intact, while `showOutline` still omits the outline markup completely. The paper no longer appears as a rounded shadow card, the active outline item uses a slim blue indicator instead of another card, and the selection bubble is a compact translucent anchored material.

## visual grounding

Read the approved editor specification and inspected the exact `reference-editor.png`. Direct `view_image` calls against both the worktree file and a main-root copy were rejected by the Windows split-root sandbox wrapper. The same source image was therefore rendered read-only through a downsampled Base64 transfer. The implementation follows its thin top bar, centered save status, uncarded document surface, narrow right outline, persistent tree selection, and selection-adjacent formatting material.

## RED / GREEN

### approved editor contracts

- Baseline reproduction: `document-outline-layout.test.mjs` failed on its stale 720px/old outline assertion; `table-editor-integration.test.mjs` failed because its branch extractor assumed LF-only source.
- RED: replaced old layout contracts with the approved document-first grid, optional right outline, uncarded paper, quiet active heading, new document top bar, automatic-save copy, overflow actions, and translucent bubble contracts.
- RED evidence: `document-outline-layout.test.mjs` exited 1 on the old `196px minmax(0, 1120px)` grid; `library-shell-ui.test.mjs` exited 1 because `renderDocumentTopbar` did not exist.
- Baseline repair: made the table branch extraction CRLF-safe and added a positive assertion that the existing branch opens `tablePickerPositionForTrigger(context.event, ...)`. The repaired test passed against the unchanged table behavior.
- GREEN: implemented the new top bar, menu, document/outline order, paper/outline styling, and bubble material. The focused shell and table tests passed.
- Test correction: the first paper assertion incorrectly treated `box-shadow: none` as a shadow. It was corrected to positively require `border-radius: 0` and `box-shadow: none`; no production change was made to satisfy the faulty assertion.

### theme self-review cycle

- RED: added contracts requiring the new top bar, overflow menu, and bubble to reuse Task 4's dynamic `--sheet` material. The shell test exited 1 on the fixed light backgrounds.
- GREEN: changed only those three materials to `var(--sheet)`. The shell test returned to exit 0, preserving light/dark/automatic theme behavior.

## tests

Focused/editor checks:

- `node tests/document-outline-layout.test.mjs` — pass.
- `node tests/draft-image-persistence.test.mjs` — pass.
- `node tests/markdown-paste.test.mjs` — pass.
- `node tests/table-editor-integration.test.mjs` — pass.
- `node tests/table-model.test.mjs` — pass.
- `node tests/library-shell-ui.test.mjs` — pass.
- `node --check static/app.js` — pass.
- `node --check static/library-ui.mjs` — pass.
- `node --check static/library-ui-model.mjs` — pass.

Full verification:

- Full `tests/*.test.mjs` sweep — 12 passed, 0 failed.
- `git diff --check` — pass, no output.

## commit

- `feat: refine notebook reading and editing` (exact hash included in the worker handoff).

## files

- `static/app.js` — adds the document top bar and overflow menu, keeps publishing disabled while active, and renders the paper before the gated outline.
- `static/app.css` — adds quiet editor chrome, removes the paper card treatment, moves the outline to a right reading rail, and refines the selection bubble.
- `tests/document-outline-layout.test.mjs` — replaces stale left-outline/card assertions with the approved document-first contracts.
- `tests/library-shell-ui.test.mjs` — covers save state, top-level controls, overflow actions, outline gating, and preference-aware editor materials.
- `tests/table-editor-integration.test.mjs` — repairs the CRLF-sensitive stale branch matcher while strengthening the existing table-picker behavior assertion.
- `.superpowers/sdd/2026-07-31-notebook-library-redesign/task-5-report.md` — records Task 5 evidence and scope review.

## self-review

- Confirmed the Library Rail and context tree stay mounted in reading and editing modes.
- Confirmed tree selection depends on `activeId`, not document mode, and retains its full-row/indicator/icon selected state.
- Confirmed `showOutline === false` omits `DocumentOutline`, while outline calculation remains available when re-enabled.
- Confirmed outline extraction, scroll listener, click scrolling, and active-heading visibility logic are unchanged.
- Confirmed the Tiptap editor, selection bubble behavior, plus menu, drag handle, code tools, table tools, math nodes, attachments, and authentication paths are unchanged.
- Confirmed delete drafts is absent from the top-level toolbar and rename/delete actions are accessible menu items.
- Confirmed the overflow closes on outside click, navigation, note selection, mode change, modal opening, and destructive actions through the existing menu state lifecycle.
- Confirmed no publish-review markup, selection model, GitHub API logic, note format, storage key, or cache version changed.

## concerns

- Direct `view_image` inspection remained unavailable because the Windows sandbox could not enforce split writable roots. The exact reference was inspected via a read-only Base64 rendering instead.
- Interactive browser screenshot verification is intentionally deferred to Task 7. Task 6's publish review sheet was not modified.

## review fix round

Addressed both Important findings from `task-5-review.md` with a RED/GREEN cycle.

- RED: added lifecycle contracts for `saving`, `saved`, and `error`, including the failure transition; added a persistence projection contract proving modal, authentication, menu, message, publish sync, and preference UI state cannot retrigger notebook persistence.
- GREEN: introduced an independent local persistence lifecycle, persisted a stable serialized notebook payload, and kept publish progress/error state exclusively on the publish control.
- RED: added executable menu-key resolution contracts for initial navigation, Arrow Up/Down wrapping, Home/End, Escape, and non-navigation keys, plus source integration contracts for focus management and action closure.
- GREEN: moved the overflow into a stateful component that focuses the first enabled item, supports wrapped keyboard navigation, closes on Escape and restores trigger focus, and closes before every menu action.

Review-fix verification:

- `node tests/library-interactions.test.mjs` — pass.
- `node tests/library-shell-ui.test.mjs` — pass.
- Full `tests/*.test.mjs` sweep — 12 passed, 0 failed.
- `node --check static/app.js` — pass.
- `node --check static/library-ui-model.mjs` — pass.
- `git diff --check` — pass, no output.

Task 6's publish review sheet remains untouched.
