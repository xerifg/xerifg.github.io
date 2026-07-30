# Table Column Boundary Hover Fix

## Goal

Remove the blue vertical highlight shown when the pointer merely passes over a table column boundary.

## Design

Keep the column-resize hit area and `col-resize` cursor. Remove the blue background from `.table-column-drag-handle:hover`; retain its `:active` blue background so an in-progress resize remains visible.

Do not change row controls, column insertion controls, or explicit row and column selection highlighting.

## Success Criteria

- Hovering a column boundary does not draw a blue vertical line.
- Dragging a column boundary continues to expose an active resize indication.
- The table editor integration test passes.
