# Spacious Knowledge Layout Design

## Goal

Increase the three navigation surfaces and the adjustable document-width ceiling without losing the calm, balanced composition of the current knowledge-base interface.

## Approved dimensions

- Primary rail: `56px` to `68px` on desktop.
- Knowledge directory: `260px` to `304px` on desktop.
- Document outline: `210px` to `244px` on desktop.
- Adjustable document width: retain the current saved/default value, but raise the settings control maximum from `920px` to `1120px`.
- Keep the document-width step at `20px` and the minimum at `640px`.

## Layout behavior

- Desktop shell columns become `68px 304px minmax(0, 1fr)`.
- Rail controls grow proportionally inside the wider rail; icons and labels retain their current visual hierarchy instead of scaling aggressively.
- The directory gains horizontal room for longer folder and note titles. Row height and indentation remain unchanged.
- The outline stays viewport-fixed below the `64px` top bar, uses `244px`, and keeps its internal vertical scrolling.
- Medium desktop uses a flexible paper column, a `24px` gap, and the dedicated `244px` outline column. The paper shrinks below the requested width when the viewport cannot safely fit it.
- Independent full-content-area centering starts at `2048px`, not `1600px`. This prevents a document set to `1120px` from colliding with the wider outline.
- At `1100px` and below, retain the existing compact behavior: the right outline is hidden. At `900px` and below, retain the existing mobile shell dimensions rather than forcing the desktop expansion.

## Document width behavior

- Existing users keep their stored content width; this change does not silently widen notes.
- The settings slider allows values through `1120px`.
- The rendered paper remains constrained by the space available at the current viewport, so a large preference cannot create horizontal overflow or cover the outline.

## Visual principles

- The change improves legibility and wayfinding through space, not heavier decoration.
- Existing colors, typography, row heights, borders, selection indicators, and motion remain unchanged.
- The wider chrome should feel deliberate and quiet: the article remains the primary focus, with navigation and outline acting as stable peripheral tools.

## Verification

- Add source contracts for the `68px`, `304px`, `244px`, `1120px`, and `2048px` values.
- Verify the document paper does not overlap the outline at representative desktop widths, including `1600px`, `1920px`, and `2048px`.
- Verify the outline remains fixed while the document scrolls.
- Verify `1100px` still hides the outline and compact/mobile behavior remains intact.
- Run the complete Node regression suite, syntax checks, `git diff --check`, and browser console inspection.
