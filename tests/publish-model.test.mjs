import assert from "node:assert/strict";
import * as publishModel from "../static/publish-model.mjs";
import { buildMissingRemoteNote, buildPublishChangeDetails, buildPublishChangeSet, mergeSelectedPublishState, reconcilePublishedNotes, validatePublishSelection } from "../static/publish-model.mjs";

const missingRemoteNote = buildMissingRemoteNote({
  id: "unavailable",
  title: "Remote unavailable",
  folderId: "work",
  tags: [],
  updatedAt: "2026-07-27T10:00:00.000Z",
  file: "notebooks/docs/unavailable.json"
}, "2026-07-27T11:00:00.000Z");
assert.deepEqual(missingRemoteNote, {
  id: "unavailable",
  title: "Remote unavailable",
  folderId: "work",
  tags: [],
  date: "2026-07-27T10:00:00.000Z",
  file: "notebooks/docs/unavailable.json",
  dirty: false,
  publishedAt: "2026-07-27T10:00:00.000Z",
  assets: [],
  html: "",
  missingRemote: true
}, "a missing remote document should retain its index summary for a later publish retry");
const missingRemoteDetails = buildPublishChangeDetails(
  {
    folders: [],
    notes: [{ id: "unavailable", title: "Remote unavailable", folderId: null, tags: ["Published"], html: "<p>local body</p>", assets: [{ id: "local-asset", name: "local.png", remotePath: "notebooks/assets/unavailable/local.png" }] }],
    deletedTags: []
  },
  { folders: [], notes: [missingRemoteNote], deletedTags: [] },
  { id: "note:unavailable", kind: "note", action: "update", noteId: "unavailable", title: "Remote unavailable" }
);
assert.match(
  missingRemoteDetails.find((detail) => detail.label === "远端详情")?.remote || "",
  /未加载/,
  "a missing remote document should be shown as unavailable instead of pretending it has no body or attachments"
);
assert.notEqual(
  missingRemoteDetails.find((detail) => detail.label === "附件")?.remote,
  "无附件",
  "missing remote attachment details should not be rendered as an empty attachment list"
);

const remote = {
  folders: [{ id: "work", name: "Work", parentId: null }],
  notes: [
    { id: "keep", title: "Remote keep", folderId: "work", tags: ["Published"], html: "<p>keep</p>", assets: [], file: "notebooks/docs/keep.json" },
    { id: "update", title: "Remote update", folderId: "work", tags: ["Published"], html: "<p>old</p>", assets: [], file: "notebooks/docs/update.json" },
    { id: "delete", title: "Remote delete", folderId: "work", tags: ["Published"], html: "<p>delete</p>", assets: [], file: "notebooks/docs/delete.json" }
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
assert.equal(changeSet.changes.find((change) => change.id === "folders").title, "目录结构", "folder changes should have a readable publish review title");
assert.deepEqual(changeSet.selectedIds, changeSet.changes.map((change) => change.id), "all detected changes should be selected initially");

const updateDetails = buildPublishChangeDetails(local, remote, changeSet.changes.find((change) => change.id === "note:update"));
assert.deepEqual(
  updateDetails.map((detail) => detail.label),
  ["标题", "正文"],
  "a note update should explain which document fields changed"
);
assert.equal(updateDetails.find((detail) => detail.label === "标题").remote, "Remote update", "title details should show the remote value");
assert.equal(updateDetails.find((detail) => detail.label === "标题").local, "Local update", "title details should show the local value to publish");
assert.match(updateDetails.find((detail) => detail.label === "正文").summary, /文本长度/, "body details should summarize text content changes");

const folderDetails = buildPublishChangeDetails(local, remote, changeSet.changes.find((change) => change.id === "folders"));
assert.deepEqual(folderDetails.map((detail) => detail.label), ["目录"], "folder changes should expose a readable folder diff summary");
assert.match(folderDetails[0].local, /Local/, "folder details should include the local folder tree that will be published");

const samePublishedAssetRemote = {
  folders: remote.folders,
  notes: [{
    id: "asset-note",
    title: "Asset note",
    folderId: "work",
    tags: ["Published"],
    html: '<p><img src="notebooks/assets/asset-note/image.png"></p>',
    assets: [{
      id: "image-1",
      name: "image.png",
      mimeType: "image/png",
      size: 123,
      remotePath: "notebooks/assets/asset-note/image.png",
      remoteUrl: "notebooks/assets/asset-note/image.png"
    }],
    file: "notebooks/docs/asset-note.json"
  }],
  deletedTags: []
};
const samePublishedAssetLocal = {
  ...samePublishedAssetRemote,
  notes: [{
    ...samePublishedAssetRemote.notes[0],
    assets: [{
      ...samePublishedAssetRemote.notes[0].assets[0],
      localUrl: "/api/local-assets/asset-note/image.png",
      localPath: ".notebook-cache/assets/asset-note/image.png",
      dataUrl: "data:image/png;base64,ignored-local-preview"
    }]
  }]
};
assert.deepEqual(
  buildPublishChangeSet(samePublishedAssetLocal, samePublishedAssetRemote).changes,
  [],
  "local-only asset cache fields should not mark a published document as changed"
);

const samePublishedAssetWithLocalHtml = {
  ...samePublishedAssetLocal,
  notes: [{
    ...samePublishedAssetLocal.notes[0],
    html: '<p><img src="/api/local-assets/asset-note/image.png"></p>'
  }]
};
assert.deepEqual(
  buildPublishChangeSet(samePublishedAssetWithLocalHtml, samePublishedAssetRemote).changes,
  [],
  "local asset URLs in draft HTML should compare equal to their published remote paths"
);

const remoteWithPublishedOrphanAsset = {
  ...samePublishedAssetRemote,
  notes: [{
    ...samePublishedAssetRemote.notes[0],
    assets: [
      ...samePublishedAssetRemote.notes[0].assets,
      {
        id: "orphan-image",
        name: "orphan.png",
        fileName: "orphan.png",
        type: "image/png",
        size: 456,
        localUrl: "data:image/png;base64,large-published-local-data",
        remotePath: "notebooks/assets/asset-note/orphan.png",
        remoteUrl: "notebooks/assets/asset-note/orphan.png",
        cached: false,
        published: false
      }
    ]
  }]
};
assert.deepEqual(
  buildPublishChangeSet(samePublishedAssetRemote, remoteWithPublishedOrphanAsset).changes,
  [],
  "unreferenced published asset metadata should not mark a document as changed"
);

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

const publishedUpdate = { ...local.notes[1], html: "<p>published</p>", dirty: false, publishedAt: "2026-07-27T00:00:00.000Z" };
const reconciledNotes = reconcilePublishedNotes(local.notes, [publishedUpdate], new Set(["note:update"]));
assert.equal(reconciledNotes.find((note) => note.id === "update").html, "<p>published</p>", "a published selection should use the write result locally");
assert.equal(reconciledNotes.find((note) => note.id === "update").dirty, false, "a published selection should become clean");
assert.equal(reconciledNotes.find((note) => note.id === "create").dirty, true, "an unselected draft must remain dirty after another note publishes");

const tagRemote = { ...remote, notes: [{ ...remote.notes[0], tags: ["Legacy"] }] };
const tagLocal = { ...tagRemote, notes: [{ ...tagRemote.notes[0], tags: ["Published"], dirty: true }], deletedTags: ["Legacy"] };
const tagChangeSet = buildPublishChangeSet(tagLocal, tagRemote);
const tagOnlySelection = new Set(["tags"]);
assert.equal(validatePublishSelection(tagChangeSet.changes, tagOnlySelection).valid, false, "a tag deletion must require its affected documents to stay selected");
const selectedTagDelete = mergeSelectedPublishState(tagLocal, tagRemote, tagOnlySelection);
assert.equal(selectedTagDelete.selectedNotes.length, 0, "a tag-only selection must not write a document the user deselected");
assert.deepEqual(selectedTagDelete.state.notes[0].tags, ["Legacy"], "a rejected tag-only selection must preserve remote tags");

const freshRemote = { ...remote, notes: [...remote.notes, { id: "fresh", title: "Remote fresh", folderId: "work", tags: ["Published"], html: "<p>fresh</p>", assets: [], file: "notebooks/docs/fresh.json" }] };
const mergedWithFreshRemote = mergeSelectedPublishState(local, freshRemote, new Set(["note:update"]));
assert.equal(mergedWithFreshRemote.state.notes.some((note) => note.id === "fresh"), true, "a selected update must preserve a document added remotely after review opened");

assert.equal(typeof publishModel.assignSelectedPublishFiles, "function", "publish file assignment should be testable");
assert.equal(
  publishModel.assignSelectedPublishFiles(
    [{ id: "pointpillars", title: "PointPillars模型", file: "notebooks/docs/未命名文档.json" }],
    [{ id: "pointpillars", title: "未命名文档", file: "notebooks/docs/未命名文档.json" }]
  )[0].file,
  "notebooks/docs/pointpillars模型.json",
  "a renamed untitled document should publish to a title-based document path"
);
