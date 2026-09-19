# Notebook workspace acceptance — 2026-09-18

## Target and visual evidence

Approved combined design: `C:/Users/ethan/.codex/generated_images/01a0b4d5-47a7-7f72-a652-b7e7e13f083b/exec-4cebc452-08d0-43d7-865c-643fb01404b5.png`.

The reference and rendered desktop were visually inspected together at 1487 × 1058. A final screenshot is `.notebook-cache/upgrade/desktop-final.png`. The left column is approximately 305 px, article begins at x=340, and the right column begins at x=1115, matching the reference's main proportions. Sidebar and auxiliary widths remain user adjustable. Existing explicit preferences are preserved.

The fixture contains the same article heading and comparable paragraph/link structure. It does not insert the image generator's illustrative diagram into the user's notes. Deliberate functional additions are collapsed note properties, history/export controls, recent notes, daily notes, relation graph and explicit AI suggestions. Auxiliary tabs sit below the common document tab bar, keeping the global panel toggle reachable. UI type is slightly denser than the reference for longer real note titles.

Evidence, kept locally rather than bundled into the published site:

- `.notebook-cache/upgrade/desktop-final.png`: light desktop, two open notes, relationships visible.
- `.notebook-cache/upgrade/split.png`: main note and read-only reference.
- `.notebook-cache/upgrade/mobile.png`: 390 × 844 dark reading view after minimum-width correction.
- `.notebook-cache/upgrade/mobile-outline.png`: mobile auxiliary drawer and heading navigation.

## Passed

- Unified navigation, folder tree, bottom settings, home via brand, note tabs, auxiliary panel.
- Actual real-library loading on the normal local server; edits and publishing acceptance used the isolated fixture only.
- Full-text query `像素重建` returns the note and highlights its body excerpt; Enter opens the result. Search and template dialogs manage keyboard focus and Escape.
- Paper template creates headings and type/status. `[[WA` offers a candidate; Enter inserts `#note/demo-wa`, with relation count changing immediately.
- Renaming WA-JEPA updates the displayed source link title without changing its href, and the link still opens the renamed note.
- History lists snapshots with preview. Restoring the original version updates the active rich-text editor, resets its properties, removes later links, and retains the pre-restore snapshot.
- Daily-note repeated invocation produces only one note for the local day.
- Reference split displays another note read-only and exits correctly.
- Reading scroll position of 276 px is restored after switching to another tab and back.
- AI relation fixture produces a suggestion; no link is added until clicking “添加引用”. That click updates editor and relationship count and disables duplicate insertion.
- AI question entry is available in the right tab and scopes to the current note.
- Mobile directory and auxiliary drawers; the outline is visible after overriding legacy hiding rules. Reading region has equal client/scroll widths after overriding the legacy 720 px minimum. Both light and dark themes were inspected.
- Isolated publish workflow from tag review through selected change review to completion; repository fixture JSON contains paper properties and dailyDate. No GitHub writes were made.
- `tests/workspace-storage.html` reports PASS for JSON backup, embedded media, restored IndexedDB asset references, Markdown internal filenames, math, Mermaid source, metadata, and ZIP attachment directory.
- New knowledge/publish/ZIP tests pass, existing publishing and preference model tests pass. Worker suite passes 23/23, including new published-context relationship retrieval validation.
- Syntax checks and `git diff --check` pass.

## Regression baseline and limits

Full local suite: 28 passed test files, 11 failures. These same 11 files failed before implementation: `document-mode-toggle`, `document-note-tag-actions`, `document-outline-layout`, `document-visual-layout`, `draft-image-persistence`, `final-binding-fixes`, `library-interactions`, `library-shell-ui`, `mermaid-editor-integration`, `publish-review-diff-ui`, `table-editor-integration`. Many check old literal source strings/layout contracts; they are not counted as passing. The quick-open and image-preview assertions affected by this change were updated to their new contracts.

AI provider quality and live deployment are not validated: the browser uses a local mock, while Worker tests exercise retrieval/authentication with in-memory SQL and provider fixtures. The updated frontend and Worker should be deployed together to enable `relatedNoteId`. History and workspace state are local to the browser; exported JSON is the portable recovery format. External-origin media remains a URL; unavailable required local attachments produce an error instead of a silently incomplete backup.

## Reproduce

Use Node 22 or newer. In this environment test subprocess spawning is restricted, so tests use in-process isolation:

```powershell
node --test --experimental-test-isolation=none tests/knowledge-model.test.mjs tests/workspace-publish.test.mjs tests/notebook-zip.test.mjs
node --test --experimental-test-isolation=none cloud/tests/*.test.mjs
python tests/workspace-fixture-server.py
```

Open `http://127.0.0.1:8001/` for the isolated account, notes and publication fixture. It never forwards API calls to production. Open `/tests/workspace-storage.html` on that origin and click its test button for portable backup/export acceptance. The ordinary `python server.py` preview continues to use the actual repository notes and configured authentication.
