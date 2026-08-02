# Smooth Notebook Interactions Design

## Goal

Make the existing notebook feel immediate, stable, and calm without changing its information architecture or introducing a new visual theme.

## Scope

The work is split into independently shippable interaction groups:

1. Directory and navigation: folder expansion, note selection, drag/drop feedback, document switching, outline synchronization.
2. Editor: selected-text toolbar, draft/save/undo feedback, and practical image, table, and code-block controls.
3. Overlays and feedback: search/command palette, menus, settings sheet, keyboard/focus behavior, confirmations, and lightweight status messages.

## Interaction principles

- Use short transitions (120-220 ms) with a restrained ease-out or spring curve; motion explains a state change and never delays an action.
- Keep one clear active surface, one clear keyboard focus target, and one elevated layer at a time.
- Preserve existing desktop layout, note data, drag/drop model, and editor commands.
- Respect `prefers-reduced-motion` by removing transform-based motion while retaining visibility changes.

## Directory and navigation

- Folder expand/collapse animates its child region vertically and rotates its disclosure icon; it must remain immediately keyboard operable.
- Hover, active, dragging, and valid-drop states use separate, quiet visual tokens. Dragging uses a lifted preview and the exact insertion line or destination highlight already represented by the tree model.
- Choosing a note updates the active row immediately, gives the document canvas a brief fade/translate-in transition, and shows a lightweight skeleton only while document content is unavailable.
- The current heading updates the outline active item during normal document scrolling. Selecting an outline item scrolls the heading into view without a competing animation.

## Editor feedback

- Preserve the existing selected-text toolbar and make its placement/entry/exit consistent with other elevated panels.
- Editing marks the current note as a local draft immediately; debounced persistence progresses through `保存中`, `已保存`, and `保存失败` states. A successful save message is non-blocking and short-lived.
- Undo and redo remain keyboard-first and expose disabled/available state where controls exist.
- Existing image, table, and code-block controls remain their source of truth; their toolbars receive consistent pointer-down behavior, focus restoration, and success/failure notices.

## Overlay system

- Add a global command palette for note search, new note/new folder, navigation, and settings. It opens through a keyboard shortcut, traps focus, closes on Escape/backdrop click, and returns focus to its opener.
- Menus, selected-text toolbars, and the settings sheet share surface, elevation, z-index, entry/exit timing, and reduced-motion rules.
- Destructive note actions require an explicit confirmation dialog. Other completed actions use compact toast notices rather than blocking dialogs.

## Feedback and failure behavior

- A single toast host queues/supersedes non-critical notices and announces them accessibly.
- Local persistence exceptions expose a retryable error notice and retain the in-memory draft. No remote retry queue is added because the current app has no remote synchronization transport.

## Accessibility and verification

- All new transient layers use dialog/menu semantics as appropriate, Escape handling, focus movement, and `:focus-visible` states.
- Verify source contracts for transition tokens, command-palette keyboard actions, save-state transitions, toast behavior, and confirmation semantics.
- Run the complete Node test suite, syntax checks, diff whitespace check, and browser interaction smoke checks at desktop and compact widths.
