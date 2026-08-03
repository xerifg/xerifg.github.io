# Table insertion hover picker

## Goal

Make the row-and-column picker in the editor's plus-menu open when the pointer enters the `表格` menu item and close when it leaves that item.

## Interaction

- Pointer entry on `表格` opens the picker beside the existing insert menu item.
- Pointer exit from `表格` starts a short close delay (about 100 ms). Re-entering the item cancels the pending close so fast pointer corrections do not flicker.
- The picker closes even if the pointer moves into the picker itself; it is intentionally scoped to hovering the table item only.
- Clicking `表格` remains available for keyboard and touch users and opens the picker as it does today.
- Selecting a grid cell inserts that table and closes both insertion panels. Existing outside-click dismissal remains unchanged.

## Visual behavior

- Reuse the notebook's current raised-surface, border, shadow, radius, and blue selection tokens.
- Opening and closing use a brief opacity plus 4 px horizontal translation and a subtle scale transition (roughly 140 ms), matching existing menu motion.
- Respect the existing reduced-motion setting by removing movement and reducing the duration.

## Implementation boundary

- Keep position calculation and table insertion commands unchanged.
- Add hover/open-close state only around the insert menu's table item and `TableInsertGrid` lifecycle.
- Add focused source-level tests for pointer entry, delayed pointer exit, cancellation on re-entry, and motion styling.
