# Selective Publish Design

## Goal

Replace the current full-library publish action with a review step that shows the differences between local drafts and the GitHub-published notebook library. The user can choose which changes to publish while keeping unselected changes local.

## Scope

The feature changes the browser-based GitHub publish flow only. It does not introduce a server, change repository authentication, or alter how published pages are rendered.

## Publish Review

Opening Publish fetches the current `notebooks/index.json` and published documents from GitHub, then compares them with the local notebook state. The review modal groups changes into:

- New documents.
- Modified documents, including content, title, folder, tags, and attachments.
- Deleted documents that still exist on GitHub.
- Folder structure changes.
- Tag deletions.

Every detected change has a checkbox and is selected by default. The modal provides a clear selected-item count and a select-all control. Deleted documents are visually identified as deletions before confirmation.

## Selection Rules

Users may exclude any detected document change. Excluded changes remain in local storage as drafts and are shown again during the next publish review.

When a selected document depends on an updated folder, tag, or index entry, the publish flow automatically updates the shared `notebooks/index.json`. This dependency is not independently optional: the online notebook relies on its index to expose document titles, folders, and tags correctly.

Folder and tag changes not required by any selected document remain local unless the user explicitly selects their corresponding review item.

## GitHub Writes

For the selected change set, publishing writes only the required files:

- A selected new or modified document writes its document JSON and selected pending assets.
- A selected deletion removes its document JSON from GitHub.
- Any selected change that affects the library view updates `notebooks/index.json` with a merge of the selected local changes and the unselected remote state.

The existing GitHub Contents API continues to be used. GitHub may therefore show several small commits for one publish operation, such as one commit per document, asset, or index update. The feature guarantees file scope, not a single atomic Git commit.

## Local State After Publishing

Successfully published selected documents are marked clean and receive the new published metadata. Unselected edits keep their local content and dirty state. A failed write leaves the affected local draft unchanged and presents an error; later publish attempts can retry it.

## Architecture

Extract pure change-set and merge helpers into a small publish model module so their behavior can be tested without the browser UI. `static/app.js` remains responsible for loading GitHub data, rendering the modal, collecting checkbox selections, performing GitHub writes, and updating local application state.

The publish model receives local and remote notebook libraries, returns typed change records, and merges only selected changes into a remote-based index. The UI must not infer change semantics itself.

## Testing

Automated Node tests cover change detection for new, modified, and deleted documents; selection-aware index merging; and preservation of unselected remote content. Existing tests continue to run. The app code is syntax-checked after the UI integration.

## Out of Scope

- Combining all selected file updates into one atomic Git commit.
- A persistent staging area separate from the publish modal.
- Conflict-resolution UI for simultaneous edits made directly on GitHub and locally.
