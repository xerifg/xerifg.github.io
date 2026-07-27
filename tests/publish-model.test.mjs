import assert from "node:assert/strict";
import { buildPublishChangeSet, mergeSelectedPublishState } from "../static/publish-model.mjs";

const remote = {
  folders: [{ id: "work", name: "Work", parentId: null }],
  notes: [
    { id: "keep", title: "Remote keep", folderId: "work", tags: ["Notes"], html: "<p>keep</p>", assets: [], file: "notebooks/docs/keep.json" },
    { id: "update", title: "Remote update", folderId: "work", tags: ["Notes"], html: "<p>old</p>", assets: [], file: "notebooks/docs/update.json" },
    { id: "delete", title: "Remote delete", folderId: "work", tags: ["Notes"], html: "<p>delete</p>", assets: [], file: "notebooks/docs/delete.json" }
  ],
  deletedTags: []
};

const local = {
  folders: [{ id: "work", name: "Work", parentId: null }, { id: "local", name: "Local", parentId: null }],
  notes: [
    { ...remote.notes[0], dirty: false },
    { ...remote.notes[1], title: "Local update", html: "<p>new</p>", dirty: true },
    { id: "create", title: "Local create", folderId: "local", tags: ["AI"], html: "<p>create</p>", assets: [], file: "notebooks/docs/create.json", dirty: true }
  ],
  deletedTags: ["Legacy"]
};

const changeSet = buildPublishChangeSet(local, remote);
assert.deepEqual(
  changeSet.changes.map(({ id, action }) => [id, action]),
  [["note:update", "update"], ["note:create", "create"], ["note:delete", "delete"], ["folders", "update"], ["tags", "delete"]],
  "the change set should expose only changed notes plus global folder/tag changes"
);
assert.deepEqual(changeSet.selectedIds, changeSet.changes.map((change) => change.id), "all detected changes should be selected initially");

const selectedUpdate = mergeSelectedPublishState(local, remote, new Set(["note:update"]));
assert.equal(selectedUpdate.state.notes.find((note) => note.id === "update").title, "Local update", "a selected update should use local content");
assert.equal(selectedUpdate.state.notes.find((note) => note.id === "keep").title, "Remote keep", "an unchanged remote document should remain present");
assert.equal(selectedUpdate.state.notes.some((note) => note.id === "create"), false, "an unselected create must not enter the published index");
assert.equal(selectedUpdate.state.notes.some((note) => note.id === "delete"), true, "an unselected delete must preserve the remote document");

const selectedDelete = mergeSelectedPublishState(local, remote, new Set(["note:delete"]));
assert.equal(selectedDelete.state.notes.some((note) => note.id === "delete"), false, "a selected delete should remove the remote document from the index");
assert.deepEqual(selectedDelete.deletedRemoteNotes.map((note) => note.file), ["notebooks/docs/delete.json"], "a selected delete should target exactly its remote file");

const selectedCreate = mergeSelectedPublishState(local, remote, new Set(["note:create"]));
assert.equal(selectedCreate.state.notes.find((note) => note.id === "create").title, "Local create", "a selected create should enter the published index");
assert.equal(selectedCreate.includeFolders, true, "a selected note in a local-only folder must carry its folder dependency");

const movedFolderLocal = {
  ...local,
  folders: [{ id: "work", name: "Renamed work", parentId: null }],
  notes: local.notes.filter((note) => note.id !== "create")
};
const selectedMove = mergeSelectedPublishState(movedFolderLocal, remote, new Set(["note:update"]));
assert.equal(selectedMove.includeFolders, true, "a selected document in a changed existing folder must carry its folder dependency");
assert.equal(selectedMove.state.folders[0].name, "Renamed work", "the selected folder dependency should use the local folder structure");
