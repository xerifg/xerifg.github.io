# Table Color Toolbar Design

## Goal

Improve the selected table-cell floating toolbar so text color behaves like the main document text color picker, and table cell background color can be changed from the table toolbar in a Feishu-like panel.

## Requirements

- Keep the normal selected-text bubble toolbar hidden while a table selection is active.
- Reuse the same text color palette and reset behavior used by the document text selection toolbar.
- Add a table-specific cell background color panel labeled as cell background color.
- Persist cell background colors through the existing `backgroundColor` table cell and header attributes.
- Keep existing table toolbar actions for style, alignment, merge/split, and row or column deletion.
- Do not add new editor dependencies or change the saved document format beyond existing Tiptap marks and table cell attributes.

## Design

The document color panel remains the source of interaction style: compact sections, swatches, a transparent background option, and a restore-default action. The table toolbar receives two color triggers. The text color trigger applies Tiptap color marks to selected table text via `text-color-*` commands. The cell color trigger applies table cell `backgroundColor` attributes via `background-*` commands and clears them through a new `background-reset` command.

The table toolbar continues to manage its menu state locally. Color menus render as richer panels instead of the older three-item highlight list. The CSS reuses the existing `.feishu-color-panel` swatch styling and adds only table-specific placement and trigger affordances.

## Testing

Update the existing source-level table editor integration test to assert that the table toolbar exposes separate text color and cell background color triggers, uses the shared color panel styling, and supports the new background reset command.
