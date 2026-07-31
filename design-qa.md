# Notebook Library Redesign — Design QA

## Scope and references

- Design target: Apple-like personal knowledge library with a 56 px primary rail, a 260 px contextual sidebar, a knowledge-base home, integrated tags and settings, a focused document reader/editor, and an in-place publish review sheet.
- Reference images:
  - Home: `C:/Users/ethan/.codex/generated_images/019fb614-6beb-7623-b919-7c71d6838622/exec-05d32201-c2a6-4d4c-8e62-141f33482c92.png`
  - Tags: `C:/Users/ethan/.codex/generated_images/019fb614-6beb-7623-b919-7c71d6838622/exec-b9fc5d80-9734-46a4-9f36-01edf4a1c9b5.png`
  - Settings: `C:/Users/ethan/.codex/generated_images/019fb614-6beb-7623-b919-7c71d6838622/exec-45fc0127-f615-4dd7-a0df-e7d06d30fa5a.png`
  - Editor: `C:/Users/ethan/.codex/generated_images/019fb614-6beb-7623-b919-7c71d6838622/exec-95f56d6d-6d4e-49be-b28a-84bc458c29fb.png`
  - Publish: `C:/Users/ethan/.codex/generated_images/019fb614-6beb-7623-b919-7c71d6838622/exec-25c84304-1f4a-43e8-a536-79212ce89e93.png`

## Environment

- Browser: Codex in-app browser.
- Desktop CSS viewport: 1487 × 1058; screenshot content area: 1487 × 980; device pixel ratio: 1.
- Responsive viewports: 900 × 900 and 640 × 900.
- Reference size: 1487 × 1058 (publish reference 1486 × 1058). Desktop comparisons use a top-aligned 1487 × 980 crop so reference and implementation remain at identical scale and dimensions.
- Local preview: `http://127.0.0.1:8001/`.

## Evidence

- Home: `.superpowers/sdd/2026-07-31-notebook-library-redesign/qa/home-desktop-light-final-v2.png`
- Tags with AI selected: `.superpowers/sdd/2026-07-31-notebook-library-redesign/qa/tags-desktop-light-final-v2.png`
- Appearance settings: `.superpowers/sdd/2026-07-31-notebook-library-redesign/qa/settings-desktop-light-final-v2.png`
- ViT document reader: `.superpowers/sdd/2026-07-31-notebook-library-redesign/qa/editor-desktop-light-final-v2.png`
- Dark home: `.superpowers/sdd/2026-07-31-notebook-library-redesign/qa/home-desktop-dark-final.png`
- 900 px drawer after overlap fix: `.superpowers/sdd/2026-07-31-notebook-library-redesign/qa/home-900-drawer-final-v2.png`
- 640 px bottom rail: `.superpowers/sdd/2026-07-31-notebook-library-redesign/qa/home-640-final-v2.png`
- Same-input comparisons: `home-compare-final.png`, `tags-compare-final.png`, `settings-compare-final.png`, `editor-compare-final.png` in the same QA directory.

## Visual and interaction checks

- Typography: native Apple-style system stack, restrained hierarchy, compact metadata and high-legibility document typography passed visual comparison.
- Layout and spacing: 56 px rail, 260 px desktop context sidebar, wide reading canvas, right document outline, consistent dividers, radii and whitespace passed. The implementation intentionally reflects the real repository's one top-level `Notebooks` domain rather than inventing the reference's sample domains.
- Color: light, explicit dark and automatic system-dark token contracts passed. Search, selected navigation, tree rows, settings headings, editor controls and outline foregrounds were checked after token fixes.
- Icons and assets: Lucide icons are used for navigation, folders, notes and actions; the existing ViT image is rendered as a real asset without stretching or placeholder drawing.
- Copy and data: knowledge-library language and actual notebook/tag counts are used; no recent-notes feed is presented on home.
- Navigation: first load opens Home; Home / Notes / Tags / Settings stay in one shell. Switching from a selected tag to Notes clears the hidden filter and restores all 22 visible tree items, including `VIT模型`.
- Tags: common/name/recent-created sort controls, AI detail, local create/rename behavior and disabled guidance without an active note passed.
- Modals: generic dialogs and delete-local-drafts use dialog semantics, initial focus, Escape, Tab trapping and focus restoration. Browser interaction confirmed the edit-auth dialog focuses the account field and returns focus to Edit on Escape.
- Publish review: the review sheet implementation and return-focus behavior are covered by publish model/UI tests. Live browser access correctly stopped at the edit-auth dialog; no password or token was entered during QA.
- Responsive: 900 px drawer opens at 300 px without covering its title; 640 px switches to a 60 px bottom rail and has no horizontal overflow.
- Runtime: the initial blank page from a bare React module import was fixed by an import map. A later browser-only `Unexpected token ')'` in the delete-drafts modal call was reproduced, fixed and protected by `browser-syntax-regression.test.mjs`. The final fresh browser tab has no console errors.

## Comparison history

1. Initial browser capture was blank because Lucide's external React import could not resolve; fixed with the import map and reloaded successfully.
2. First home comparison showed the intended shell, while real data produced one knowledge area; retained to avoid fabricating categories.
3. Branch review found tag/publish coupling, incomplete recent sorting, incomplete dark surfaces, inaccessible generic dialogs and glyph tree actions; fixed with focused regression tests.
4. Browser QA found tag-filter leakage into Notes, a 900 px drawer/title overlap, and a browser-only modal syntax failure; all were reproduced, fixed and rechecked.
5. Final dark review found a light search surface and automatic-dark settings headings; both were tokenized and verified with computed styles.
6. Final Home, Tags, Settings and Editor composites were inspected together with their references at identical scale. Remaining differences are data/content differences and authenticated editor/publish state, not shell or styling defects.

## Automated verification

- 17/17 Node test files passed.
- `node --check` passed for `static/app.js`, `static/library-ui.mjs`, and `static/library-ui-model.mjs`.
- `git diff --check` passed.

final result: passed
