# Task 4 report

## status

Complete.

## summary

Implemented the persistent settings surface without changing the editor implementation or publish-review sheet. The settings route now keeps the Library Rail, replaces the context sidebar with the seven approved settings categories, and renders an Apple-like page with quiet grouped rows, segmented controls, switches, and repository inputs.

UI preferences load once from `personal-notebook-ui-preferences-v1`, normalize independently from notebook data, persist in their own effect, and apply theme, density, transparency, and document width through root attributes and a CSS custom property. Startup still defaults to the knowledge-library home; enabling “last location” restores the saved view/document/tag state through the existing Task 1 resolver.

The implemented controls cover startup location, theme, sidebar density, translucent materials, content width, document outline visibility, default read/edit mode, and the existing GitHub owner/repository/token settings. The token is only rendered as an editable password input.

## visual grounding

Reviewed `.superpowers/sdd/2026-07-31-notebook-library-redesign/reference-settings.png` before finalizing structure and CSS. The result follows its continuous pale settings sidebar, blue selected category, uncarded grouped rows with fine dividers, compact segmented controls, native-size switches, restrained input density, and generous right-page whitespace. Behavioral placement by category follows the Task 4 brief when the reference image groups multiple sections together.

## RED / GREEN

### primary cycle

- RED: added preference normalization assertions for the 640/920 width boundaries, invalid-theme fallback, compact density, disabled transparency/outline, and edit default mode.
- RED: added shell contracts for both settings components, all seven category labels, the independent storage key, preference persistence, root data attributes/CSS variable, settings integration, default-mode use, outline gating, and effective CSS selectors.
- `node tests/library-ui-model.test.mjs` exited 0 because Task 1 already supplied the requested normalization behavior.
- `node tests/library-shell-ui.test.mjs` exited 1 at the expected missing `SettingsSidebar` export before production changes.
- GREEN: after the minimum settings components, app wiring, persistence effects, preference-driven behavior, and reference-grounded CSS were added, both focused tests and both Node syntax checks exited 0.

### self-review cycle

- RED: added a focused contract proving the knowledge-area entry path also applies `defaultMode` when it selects the first matching note. `node tests/library-shell-ui.test.mjs` exited 1 on the missing assignment.
- GREEN: applied the normalized default mode in `openArea`; the focused shell/model tests and both syntax checks returned to exit 0.

## tests

- `node tests/library-ui-model.test.mjs` — pass.
- `node tests/library-shell-ui.test.mjs` — pass.
- `node --check static/app.js` — pass.
- `node --check static/library-ui.mjs` — pass.
- Full `tests/*.test.mjs` sweep — 10 pass, 2 unchanged known baseline failures: `document-outline-layout.test.mjs` at its pre-existing 720px outline-height contract and `table-editor-integration.test.mjs` at its pre-existing table-insert branch contract.
- `git diff --check` and staged diff check — pass.

## commit

- `feat: add persistent notebook settings` (the implementation commit containing this report; exact hash is included in the worker handoff).

## files

- `static/library-ui.mjs` — adds `SettingsSidebar`, `SettingsPage`, the seven categories, and the specified grouped controls.
- `static/app.js` — loads/persists preferences independently, applies root styling state, integrates settings, reuses GitHub fields, and drives startup/outline/default-mode behavior.
- `static/app.css` — adds the settings layout and controls plus effective dark, compact, solid-material, and document-width styles.
- `tests/library-ui-model.test.mjs` — adds preference normalization boundary coverage.
- `tests/library-shell-ui.test.mjs` — adds settings integration and visible-effect contracts.
- `.superpowers/sdd/2026-07-31-notebook-library-redesign/task-4-report.md` — records Task 4 evidence and scope review.

## self-review

- Confirmed preferences are omitted from the notebook draft JSON and written to the dedicated v1 preference key.
- Confirmed startup resolution occurs only in the lazy state initializer, not in a reactive effect.
- Confirmed invalid or corrupt preference JSON returns normalized defaults.
- Confirmed all preference updates pass back through `normalizeUiPreferences`.
- Confirmed the seven setting labels match the approved order exactly.
- Confirmed owner/repository/token update the pre-existing `state.settings` object; branch remains pinned to the existing `main` behavior.
- Confirmed no token text is rendered outside a password input.
- Confirmed tree selection, tag-result selection, knowledge-area selection, and new-note creation use the stored default mode.
- Confirmed outline markup is omitted when disabled and the no-outline grid does not retain an empty outline column.
- Confirmed paper width uses `--document-width` with the old 1120px value retained only as a CSS fallback for compatibility.
- Confirmed the existing `20260731-library-v1` cache version and shared component interfaces were preserved.
- Confirmed no editor behavior, publish-review markup, GitHub API logic, note format, or cache version was changed.

## concerns

The full suite still contains the two known stale failures documented by Tasks 2 and 3; Task 4 introduces no additional failing test file or new failure point. Visual implementation was grounded against the supplied settings reference, but interactive browser screenshot verification remains part of the later final-polish task rather than this scoped implementation.
