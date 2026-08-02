# Document Image Preview Design

## Goal

Clicking an image in reading or editing mode opens a polished full-screen preview with smooth open and close transitions.

## Interaction

- Reading mode handles clicks on `.tiptap-reader img`.
- Editing mode handles clicks on `.feishu-editor img`.
- The preview closes when the user clicks the backdrop, clicks the close button, or presses `Escape`.
- The preview does not change document content.

## Architecture

`DocumentPaper` owns a small image preview state because it already renders both the reader and the editor. It passes an image-click callback into `TiptapEditor` and attaches the same callback to the reader. The preview is a React-rendered overlay inside the document workspace.

The transition uses the clicked image's bounding box as the animation origin. CSS variables describe the source rectangle so opening can feel connected to the original image, with a scale/fade fallback if geometry is unavailable.

## Testing

Add a focused source-level regression test that confirms the shared preview hook is wired into both reading and editing mode and that the overlay styles exist. Run the focused test plus existing document/image tests.
