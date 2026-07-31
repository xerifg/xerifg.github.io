import assert from "node:assert/strict";
import {
  buildTagReturnContext,
  buildVisibleTreeItems,
  enterTagView,
  groupTagRecords,
  localPersistenceStatusText,
  notebookStateForPersistence,
  resolveLocalPersistenceStatus,
  resolveMenuKeyboard,
  resolveTreeKeyboard,
  restoreTagView
} from "../static/library-ui-model.mjs";

const grouped = groupTagRecords([
  { name: "AI", count: 3, noteIds: ["a"] },
  { name: "产品设计", count: 2, noteIds: ["b"] },
  { name: "Docker", count: 1, noteIds: ["c"] },
  { name: "草稿", count: 1, noteIds: ["d"] },
  { name: "Vision", count: 1, noteIds: ["e"] }
]);
assert.deepEqual(grouped.technology.map((tag) => tag.name), ["AI", "Vision"]);
assert.deepEqual(grouped.topic.map((tag) => tag.name), ["产品设计"]);
assert.deepEqual(grouped.tool.map((tag) => tag.name), ["Docker"]);
assert.deepEqual(grouped.status.map((tag) => tag.name), ["草稿"]);
assert.deepEqual(groupTagRecords([{ name: "未分类主题", count: 1, noteIds: [] }]).topic.map((tag) => tag.name), ["未分类主题"]);

const initialTagState = {
  view: "home",
  activeId: "keep-open",
  selectedTag: "",
  tagQuery: "vis",
  tagSort: "name",
  tagReturnContext: null,
  modal: "old",
  modalContext: { stale: true },
  openCreateMenu: "folder"
};
const fromHome = enterTagView(initialTagState, "Vision", { clearQuery: true });
assert.equal(fromHome.view, "tags");
assert.equal(fromHome.tagQuery, "");
assert.equal(fromHome.activeId, "keep-open");

const searchedSelection = enterTagView(initialTagState, "Vision");
assert.equal(searchedSelection.tagQuery, "vis");
assert.equal(searchedSelection.tagSort, "name");
assert.equal(searchedSelection.selectedTag, "Vision");
const openedFromTag = {
  ...searchedSelection,
  tagReturnContext: buildTagReturnContext(searchedSelection),
  view: "library",
  activeId: "vision-note"
};
const returnedToTag = restoreTagView(openedFromTag);
assert.deepEqual(
  {
    view: returnedToTag.view,
    activeId: returnedToTag.activeId,
    selectedTag: returnedToTag.selectedTag,
    tagQuery: returnedToTag.tagQuery,
    tagSort: returnedToTag.tagSort,
    tagReturnContext: returnedToTag.tagReturnContext
  },
  {
    view: "tags",
    activeId: "vision-note",
    selectedTag: "Vision",
    tagQuery: "vis",
    tagSort: "name",
    tagReturnContext: null
  }
);

const treeItems = buildVisibleTreeItems(
  [
    { id: "root", parentId: null },
    { id: "child", parentId: "root" }
  ],
  [
    { id: "root-note", folderId: "root" },
    { id: "child-note", folderId: "child" },
    { id: "orphan", folderId: "" }
  ],
  {}
);
assert.deepEqual(treeItems.map((item) => item.id), ["root", "root-note", "child", "child-note", "orphan"]);
assert.deepEqual(resolveTreeKeyboard(treeItems, "root", "ArrowDown"), { focusId: "root-note" });
assert.deepEqual(resolveTreeKeyboard(treeItems, "root-note", "ArrowUp"), { focusId: "root" });
assert.deepEqual(resolveTreeKeyboard(treeItems, "child-note", "Home"), { focusId: "root" });
assert.deepEqual(resolveTreeKeyboard(treeItems, "root", "End"), { focusId: "orphan" });
assert.deepEqual(resolveTreeKeyboard(treeItems, "root", "ArrowRight"), { focusId: "root-note" });
assert.deepEqual(resolveTreeKeyboard(treeItems, "child-note", "ArrowLeft"), { focusId: "child" });
assert.deepEqual(resolveTreeKeyboard(treeItems, "root", "ArrowLeft"), { focusId: "root", toggleFolderId: "root" });

const collapsedItems = buildVisibleTreeItems(
  [{ id: "root", parentId: null }],
  [{ id: "root-note", folderId: "root" }],
  { root: true }
);
assert.deepEqual(collapsedItems.map((item) => item.id), ["root"]);
assert.deepEqual(resolveTreeKeyboard(collapsedItems, "root", "ArrowRight"), { focusId: "root", toggleFolderId: "root" });
assert.deepEqual(resolveTreeKeyboard(collapsedItems, "root", "ArrowDown"), { focusId: "root" });

const searchedTreeItems = buildVisibleTreeItems(
  [
    { id: "root", parentId: null },
    { id: "empty", parentId: null }
  ],
  [{ id: "root-note", folderId: "root" }],
  { root: true },
  { isSearching: true }
);
assert.deepEqual(searchedTreeItems.map((item) => item.id), ["root", "root-note"]);
assert.equal(searchedTreeItems[0].expanded, true);

assert.equal(localPersistenceStatusText("saving"), "正在保存…");
assert.equal(localPersistenceStatusText("saved"), "已自动保存");
assert.equal(localPersistenceStatusText("error"), "保存失败");
assert.equal(localPersistenceStatusText("publish-error"), "已自动保存");
assert.equal(resolveLocalPersistenceStatus("start"), "saving");
assert.equal(resolveLocalPersistenceStatus("success"), "saved");
assert.equal(resolveLocalPersistenceStatus("failure"), "error");

assert.deepEqual(
  notebookStateForPersistence({
    view: "library",
    activeId: "note-1",
    folders: [{ id: "folder-1" }],
    notes: [{ id: "note-1", title: "Draft" }],
    uiPreferences: { theme: "dark" },
    authenticated: true,
    pendingAuthAction: "publish",
    modal: "publish-review",
    modalContext: { selectedIds: ["note-1"] },
    openCreateMenu: "document-actions",
    syncStatus: "error",
    message: "publish failed"
  }),
  {
    view: "library",
    activeId: "note-1",
    folders: [{ id: "folder-1" }],
    notes: [{ id: "note-1", title: "Draft" }]
  }
);

assert.deepEqual(resolveMenuKeyboard(0, "ArrowDown", 3), { focusIndex: 1 });
assert.deepEqual(resolveMenuKeyboard(2, "ArrowDown", 3), { focusIndex: 0 });
assert.deepEqual(resolveMenuKeyboard(0, "ArrowUp", 3), { focusIndex: 2 });
assert.deepEqual(resolveMenuKeyboard(1, "Home", 3), { focusIndex: 0 });
assert.deepEqual(resolveMenuKeyboard(1, "End", 3), { focusIndex: 2 });
assert.deepEqual(resolveMenuKeyboard(1, "Escape", 3), { close: true, focusIndex: 1 });
assert.deepEqual(resolveMenuKeyboard(-1, "ArrowDown", 3), { focusIndex: 0 });
assert.deepEqual(resolveMenuKeyboard(1, "Tab", 3), { focusIndex: 1 });
