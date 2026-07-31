# Document Page Visual QA

## Comparison target

- Source visual truth: `C:/Users/ethan/AppData/Local/Temp/codex-clipboard-ccf1ee7c-e728-472c-b920-040fc6bde137.png`
- Rendered implementation: `.superpowers/qa/document-final-viewport.png`
- Combined same-input comparison: `.superpowers/qa/comparison-final.png`
- Browser: Codex in-app browser at `http://127.0.0.1:8000/`
- Viewport: 1488 x 1058 CSS px, device scale 1.
- Source pixels: 1487 x 1058. Implementation pixels: 1488 x 1058. The implementation was normalized to 1487 x 1058 only for the side-by-side composite; no aspect-ratio or density mismatch was used for judgment.
- State: light theme, document reader, expanded notebook tree, active document, visible outline. The source shows the same document shell in edit mode. The authenticated editor itself was not opened because edit access requires user credentials; shared layout CSS and editor selectors were verified statically instead.

## Findings

No actionable P0, P1, or P2 visual differences remain in the approved scope.

The remaining visible differences are expected content/state differences: the source uses a longer ViT sample in edit mode, while the implementation evidence uses the local personal-knowledge-base sample in reader mode. These differences change above-the-fold content volume but not the shell geometry being compared.

## Required fidelity surfaces

- Fonts and typography: system font stack retained; document title is 36 px with 1.2 line height, subtle negative tracking, and a calmer 16 px / 1.78 body rhythm. The hierarchy and wrapping are consistent with the reference.
- Spacing and layout rhythm: 64 px top bar, independently centered 760 px paper column, and a 210 px outline pinned to the far-right edge. At 1600 px and wider the two surfaces share one grid area so the article stays centered in the full content viewport; from 1101-1599 px they use a flexible article column plus a 210 px outline column with a 24 px gap. The outline runs from directly below the top bar to the viewport bottom.
- Colors and tokens: neutral page, sidebar, divider, metadata, and code-block tokens match the restrained reference palette. Blue is reserved for active selection and editable focus states.
- Image quality and asset fidelity: no new image asset was introduced. The local note's existing image reference is preserved; the visual target contains no decorative image requiring recreation.
- Copy and content: application copy is unchanged except the visible outline heading is shortened to the source-aligned label. Dynamic note content remains the user's actual data.
- Icons and controls: existing Lucide icons and control behavior are preserved. No handcrafted icon or CSS-art substitute was introduced.

## Full-view comparison evidence

The final combined image shows the source and implementation at equal height and normalized width. Primary rail, context sidebar, top-bar baseline, title start, reading column, and outline divider now follow the same overall composition. The implementation intentionally retains the product's existing 56 px + 260 px shell rather than changing established navigation behavior.

## Focused region evidence

Focused inspection covered:

- Title and metadata: left inset reduced to approximately 44 px from the content boundary, matching the source's approximately 39 px visual inset.
- Outline: fixed 210 px far-right rail with concise title, active blue marker/surface, and a divider spanning from below the 64 px top bar to the viewport bottom. The list scrolls inside this full-height rail.
- Code block: reader state uses a neutral token border, preserved 44/18/18/60 padding, automatic wrapping, and no horizontal overflow. Editable focus alone receives the blue border.
- Directory: comfortable 40 px rows, clearer selected surface, and a persistent 3 px active rail.

## Comparison history

1. Baseline: the document workspace was centered in leftover space, placing the document too far right; the top bar was 52 px and code blocks were permanently blue.
   - Fix: switched the desktop workspace to left/start alignment, raised the top bar to 64 px, stabilized the 196 px outline, and made code borders neutral by default.
   - Evidence: `.superpowers/qa/document-after.png` and `.superpowers/qa/comparison.png`.
2. First comparison: the document started 28 px too low and the article's 48 px internal padding doubled the apparent left inset.
   - Fix: moved the scroll canvas directly under the top bar and reduced article horizontal padding to 8 px while preserving the 36 px canvas gutter.
   - Evidence: `.superpowers/qa/document-after-pass2.png` and `.superpowers/qa/comparison-pass2.png`.
3. Final inspection found sanitized reader code blocks use plain `pre` elements rather than only `.notebook-code-block`.
   - Fix: applied neutral border and wrapping rules to both plain and enhanced code blocks while keeping enhanced structure-specific rules scoped.
   - Post-fix evidence: `.superpowers/qa/document-final-viewport.png` and `.superpowers/qa/comparison-final.png`.
4. Ultra-wide testing exposed a large unused region to the right because the article and outline were grouped as one left-anchored unit.
   - Fix: centered the article independently in the available document viewport, pinned the outline to the far-right edge, expanded it to 210 px, and removed its half-height cap.
   - Evidence: `.superpowers/qa/centered-outline-2048.png` and `.superpowers/qa/centered-outline-1488.png`.
5. Bottom-of-document testing showed the sticky outline being pushed upward by the workspace containing block.
   - Fix: changed the desktop outline from container-constrained sticky positioning to viewport-fixed positioning at `top: 64px; right: 0`, while retaining the reserved 210 px layout column and internal outline scrolling.
   - Runtime evidence: scrolling the document from `scrollTop: 0` to its maximum keeps the outline at `top: 64px` and the viewport bottom without vertical displacement.

## Interaction and runtime checks

- Initial load still opens the knowledge-base home.
- Notes navigation, tree selection, outline display, and reader rendering were exercised.
- The edit-auth dialog opened and was cancelled without submitting credentials. Editor styling is covered by shared selectors and regression contracts; authenticated editing was not browser-tested.
- Final browser console: 0 warnings and 0 errors.
- Automated verification: 19/19 Node test files passed; syntax checks passed for `static/app.js`, `static/library-ui.mjs`, and `static/library-ui-model.mjs`; `git diff --check` passed.
- Responsive geometry: at 2048 x 1024 the paper is visually centered within 7 px of the scrollbar-adjusted content center and the outline spans y=64-1024; at 1488 x 1058 the paper and outline remain separated by 106 px and the outline spans y=64-1058; at 1100 x 900 the outline collapses with no horizontal overflow.

## Residual test gap

Authenticated edit-mode visual interaction remains a non-blocking test gap because it requires user-provided access. The reader and editor share the implemented document geometry, and editor-only code focus styling is covered by source-level regression tests.

final result: passed