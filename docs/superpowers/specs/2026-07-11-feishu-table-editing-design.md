# Feishu-Style Table Editing Design

## Goal

Upgrade the notebook's document tables from fixed, plain HTML tables to a full document-table editing experience modeled on Feishu. This feature intentionally excludes formulas, automatic calculation, and Bitable-style field schemas.

## Constraints

- Keep the current Tiptap 2.11 editor and HTML document storage.
- Preserve existing tables and published documents.
- Do not introduce a new editor framework or a separate table data format.
- Keep table actions available only while a document is in edit mode.

## User Experience

### Insertion and navigation

- Choosing Table opens a compact row-and-column picker with a 3 by 3 table as the initial selection and an enabled header row.
- Tab moves to the next cell; Shift+Tab moves to the previous cell. The final cell can create the next row so keyboard entry remains continuous.
- Pasted text and existing rich-text editing continue to work inside cells.

### Row and column controls

- Hovering a cell shows a column control above it and a row control to its left.
- Each control exposes an adjacent insert button and a compact menu for inserting before or after, deleting the active row or column, and toggling header state.
- Users can drag column boundaries to resize widths. Columns retain a sensible minimum width; tables that exceed the document width scroll horizontally instead of crushing cell content.

### Cell selection and formatting

- Selecting one or more cells shows a floating table toolbar near the selection.
- It supports bold, italic, underline, text alignment, cell background color, merging and splitting cells, and sorting the active column ascending or descending.
- Formatting applies to the selected cells and is written into table cell attributes or their paragraph content as appropriate.

### Visual language

- The active table receives a quiet outline, selected cells receive a soft blue fill, and resize handles are visible only when useful.
- Controls stay compact and do not obstruct text entry or normal reading mode.

## Architecture

- Enable the existing Tiptap Table extension's resize support and keep its table, row, cell, and header nodes as the document model.
- Extend the cell and header schemas with persistent background and alignment attributes, rendered as safe inline styles.
- Add a table interaction layer in the existing editor component. It derives the active table and cell from the ProseMirror selection, positions React controls around the table DOM, and calls Tiptap's table commands for all structural changes.
- Implement column sorting as a focused table transaction that reorders body rows based on the selected column while preserving the header row and each row's cell nodes.
- Continue saving through the existing HTML `onChange` path, so column widths, merges, styles, and table structure are published with the note.

## Error Handling

- Hide unavailable actions, such as Split when the selected cell is not merged.
- Prevent sorting when the active selection does not resolve to a single table column.
- Do not allow deletion to leave a malformed table; delegate table repair to Tiptap's table commands.
- If a stored legacy table lacks new attributes, render it with default alignment and no background color.

## Verification

- Unit-test table command helpers, including sort comparisons and selection-derived action availability.
- Add source-level integration assertions for enabled resizing, table controls, and persistence attributes.
- Run all existing Node tests.
- Verify in the browser that insert, text entry, Tab navigation, row/column changes, resize, merge/split, style persistence, and sorting work on desktop and a narrow viewport.
