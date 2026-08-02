# Folder Drag and Create Menu Design

## Goal

Let people organize the knowledge-base tree by moving a folder into another folder, and let the directory header plus button create either a root-level document or a root-level folder.

## Drag and drop behavior

- A folder dragged over the vertical middle of another folder becomes that folder's child.
- A folder dragged over the upper or lower half of another folder remains a sibling inserted before or after the target.
- Moving a folder preserves every descendant folder and document without changing their own parent references.
- A folder cannot be moved onto itself or into one of its descendants. The move is rejected and the existing explanatory toast remains available.
- On a successful move into a folder, the destination folder expands so the result is visible.
- Search mode continues to disable drag and drop, matching the current tree behavior.

## Directory header create menu

- The header plus button opens the same compact create menu pattern already used by folder rows.
- The menu contains `新建文档` and `新建文件夹`.
- Both actions create at the root level because the header has no folder context.
- The accessible label and title describe the button as a create menu rather than as folder-only creation.
- Existing folder-row plus menus remain unchanged.

## Implementation boundaries

- Update `static/tree-dnd.mjs` to accept a folder target with `inside` positioning, assign the dragged folder's `parentId`, and retain cycle protection.
- Update the tree event target calculation to expose the middle drop zone for dragged folders as well as documents.
- Update the directory header rendering to toggle the root create menu and reuse existing create actions.
- Add focused regression coverage for nesting folders, rejecting descendant moves, and the header menu contracts.

## Verification

- Run the focused tree drag-and-drop and library-shell UI tests.
- Run the complete Node regression suite, JavaScript syntax check, and `git diff --check`.
