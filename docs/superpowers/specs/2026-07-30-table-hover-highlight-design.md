# Table Hover Highlight Fix

## Goal

Prevent an inserted table from receiving a full-table blue background when the pointer is anywhere over it in edit mode, while preserving the existing hover feedback for ordinary top-level editor blocks.

## Root Cause

Tiptap renders a table inside a top-level `.tableWrapper`. The generic rule `.feishu-editor > *:hover` therefore applies its blue background to the wrapper whenever any descendant table cell is hovered. Transparent table cells reveal that wrapper background, making the whole table look selected.

## Design

Change the generic block-hover selector so it excludes `.tableWrapper`. Do not change Tiptap cell selection styles, explicit row or column selection styles, or table-control mouse handling.

Add a source-level integration assertion that requires the hover selector to exclude `.tableWrapper`. The existing assertions for explicit table-line highlighting remain unchanged.

## Success Criteria

- Hovering a table in edit mode does not tint the full table.
- Hovering other direct editor blocks keeps the existing blue feedback.
- Explicit row and column selections retain their focused highlight.
- Table editor integration tests pass.
