# Centered Document and Full-Height Outline

## Goal

Center the document independently in the content viewport and pin the outline to the far-right edge from below the top bar to the bottom of the screen.

## Scope

- Change only the desktop document-page layout and its regression coverage.
- Preserve the primary rail, notebook sidebar, document width preference, reader/editor behavior, outline navigation, themes, publishing, and stored data.
- Do not add a related-notes panel or other content to the right side.

## Layout

### Desktop, 1600 px and wider

- The paper is centered relative to the entire document content area, independent of the outline.
- The outline is anchored to the content area's right edge.
- The outline width is 210 px.
- The outline starts immediately below the 64 px document top bar and ends at the viewport bottom.
- The outline divider spans that full height.
- The outline title remains visible while its item list scrolls independently.

### Desktop, 1101-1599 px

- Reserve 210 px on the right so the outline cannot cover the paper.
- Center the paper within the remaining safe area.
- Preserve the configured document width when space permits; allow the existing responsive constraints to reduce it when necessary.

### 1100 px and below

- Preserve the existing responsive behavior: the right outline is hidden and the document uses the available width.

## Component behavior

- `.paper-scroll` remains the page's vertical scroll container.
- `.document-workspace` becomes a full-width grid rather than a tightly sized paper-plus-outline group.
- At 1600 px and wider, the paper and outline share one grid area: the paper is centered and the outline is aligned to the end edge.
- At 1101-1599 px, the grid uses a flexible paper column plus a 210 px outline column so the two cannot overlap.
- `.paper` uses `justify-self: center` for independent centering.
- `.document-outline` uses sticky positioning, `justify-self: end`, `top: 0`, `height: calc(100vh - 64px)`, and no maximum-height cap.
- `.document-outline ol` owns vertical overflow; the title does not scroll away.
- Empty-outline and outline-disabled states keep the paper centered and do not reserve a blank right rail.

## Visual details

- Keep the existing neutral divider, selected blue marker, typography, row styling, and light/dark theme tokens.
- Do not widen body text merely to fill the viewport.
- Do not add shadows or card surfaces to the outline.

## Failure and edge cases

- Long outline labels continue to wrap or truncate within the 210 px rail without horizontal overflow.
- A long outline scrolls independently and does not change the paper scroll position.
- A short outline still shows a full-height divider, avoiding the current half-height appearance.
- Disabling the outline immediately restores true full-area paper centering.
- Reader and editor modes use identical outer geometry.

## Verification

- Add source-level layout contracts for independent paper centering, the 210 px right rail, full viewport height, and the 1100/1600 px responsive rules.
- Run all existing Node regression tests and syntax checks.
- At a wide desktop viewport, verify the paper's center aligns with the document content area's center and the outline's right edge aligns with the viewport edge.
- Verify the outline begins below the top bar, reaches the bottom, scrolls internally when long, and remains hidden below the existing breakpoint.
- Check both light and dark theme rendering; authenticated editor interaction remains unchanged.