import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as libraryModel from "../static/library-ui-model.mjs";

const { buildTagBrowser, buildTagReturnContext } = libraryModel;
assert.equal(typeof libraryModel.applyLocalTagMutation, "function", "local tag mutations are part of the model contract");
const { applyLocalTagMutation } = libraryModel;

const datedNotes = [
  { id: "older", date: "2026-07-01T09:00:00.000Z", tags: ["Alpha", "Shared"] },
  { id: "newer", date: "2026-07-30T09:00:00.000Z", tags: ["Bravo", "Shared"] },
  { id: "undated", date: "not-a-date", tags: ["Undated"] }
];
const recent = buildTagBrowser(datedNotes, { sort: "recent" });
assert.deepEqual(
  recent.records.map((tag) => tag.name),
  ["Shared", "Bravo", "Alpha", "Undated"],
  "recent tags use their latest associated note date, then later tag position, then name"
);
assert.equal(recent.records[0].recentAt, "2026-07-30T09:00:00.000Z");
assert.equal(recent.records.at(-1).recentAt, "");

const created = applyLocalTagMutation(
  [{ id: "active", title: "Current", date: "2026-07-01T00:00:00.000Z", tags: ["Notes"] }],
  { mode: "create", noteId: "active", name: "Fresh", timestamp: "2026-07-31T10:00:00.000Z" }
);
assert.equal(created.changed, true);
assert.equal(created.selectedTag, "Fresh");
assert.deepEqual(created.notes[0].tags, ["Notes", "Fresh"]);
assert.equal(created.notes[0].dirty, true);
assert.equal(created.notes[0].date, "2026-07-31T10:00:00.000Z");
assert.equal(buildTagBrowser(created.notes, { sort: "recent" }).records[0].name, "Fresh");

const noAttachment = applyLocalTagMutation([], {
  mode: "create",
  noteId: "missing",
  name: "Fresh",
  timestamp: "2026-07-31T10:00:00.000Z"
});
assert.deepEqual(noAttachment, {
  notes: [],
  changed: false,
  selectedTag: "",
  error: "no-note"
});

const renamed = applyLocalTagMutation(
  [
    { id: "one", date: "2026-07-01T00:00:00.000Z", tags: ["Old", "Keep"] },
    { id: "two", date: "2026-07-02T00:00:00.000Z", tags: ["Keep", "Old"] }
  ],
  { mode: "rename", selectedTag: "Old", name: "Renamed", timestamp: "2026-07-31T11:00:00.000Z" }
);
assert.equal(renamed.changed, true);
assert.equal(renamed.selectedTag, "Renamed");
assert.deepEqual(renamed.notes.map((note) => note.tags), [["Keep", "Renamed"], ["Keep", "Renamed"]]);
assert.ok(renamed.notes.every((note) => note.dirty && note.date === "2026-07-31T11:00:00.000Z"));
assert.equal(buildTagBrowser(renamed.notes, { sort: "recent" }).records[0].name, "Renamed");

assert.equal(buildTagReturnContext({ selectedTag: "AI", tagQuery: "a", tagSort: "recent" }).sort, "recent");

const app = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
const ui = readFileSync(new URL("../static/library-ui.mjs", import.meta.url), "utf8");
const css = readFileSync(new URL("../static/app.css", import.meta.url), "utf8");

assert.match(ui, /\[\["popular",\s*"常用"\],\s*\["name",\s*"名称"\],\s*\["recent",\s*"最近创建"\]\]/);
assert.match(ui, /onRenameTag/);
assert.match(ui, /disabled:\s*!canCreateTag/);
assert.match(ui, /先打开一篇笔记，再为它新建标签/);

const activeTagView = app.slice(app.indexOf("if (state.view === \"tags\")"), app.indexOf("if (state.view === \"settings\")"));
assert.match(activeTagView, /openLocalTagModal\("create"/);
assert.match(activeTagView, /openLocalTagModal\("rename"/);
assert.doesNotMatch(activeTagView, /openPublishTagModal/);

const localTagConfirmation = app.slice(app.indexOf("const confirmLocalTag"), app.indexOf("const openPublishTagModal"));
assert.match(localTagConfirmation, /applyLocalTagMutation/);
assert.doesNotMatch(localTagConfirmation, /openPublishReview/);

const publishTagModal = app.slice(app.indexOf('if (state.modal === "publish-tags")'), app.indexOf('if (state.modal === "delete-drafts")'));
assert.doesNotMatch(publishTagModal, /data-tag-new|data-tag-name|确认并发表/);
assert.match(publishTagModal, /继续发表审阅/);

const modalShell = app.slice(app.indexOf("function ModalShell"), app.indexOf("async function loadPublishedLibrary"));
assert.match(modalShell, /role:\s*"dialog"/);
assert.match(modalShell, /"aria-modal":\s*"true"/);
assert.match(modalShell, /"aria-labelledby":/);
assert.match(modalShell, /\.focus\(\)/);
assert.match(modalShell, /event\.key === "Escape"/);
assert.match(modalShell, /event\.key !== "Tab"/);
assert.match(modalShell, /previousFocus.*\.focus\(\)/s);
for (const modal of ["name-folder", "name-note", "rename-folder", "rename-note", "manage-tag", "publish-tags", "auth"]) {
  const branchStart = app.indexOf(`state.modal === "${modal}"`);
  assert.notEqual(branchStart, -1, `${modal} modal exists`);
  assert.match(app.slice(branchStart, branchStart + 2200), /modalShell\(/);
}

assert.match(css, /--surface-page:/);
assert.match(css, /--surface-raised:/);
assert.match(css, /\[data-theme="dark"\][\s\S]*--surface-page:/);
assert.match(css, /:root\[data-theme="auto"\][\s\S]*--surface-page:/);
assert.match(css, /\.library-summary-item\s*\{[^}]*background:\s*var\(--surface-raised\)/s);
assert.match(css, /\.tag-detail\s*\{[^}]*background:\s*var\(--surface-raised\)/s);
assert.match(css, /\.settings-page\s*\{[^}]*background:\s*var\(--surface-page\)/s);
assert.match(css, /\.paper\s*\{[^}]*background:\s*var\(--sheet-solid\)/s);
assert.match(css, /\.publish-sheet\s*\{[^}]*background:\s*var\(--sheet\)/s);

const folderTree = app.slice(app.indexOf("function renderFolder"), app.indexOf("function tableSelectionInfo"));
const noteTree = app.slice(app.indexOf("function renderNoteItem"), app.indexOf("function buildDraftDeletionSummary"));
assert.match(folderTree, /icon\(isCollapsed \? "expand" : "collapse"/);
assert.match(folderTree, /icon\("add"/);
assert.match(noteTree, /icon\("more"/);
assert.doesNotMatch(folderTree, /[▸▾]/);
assert.doesNotMatch(folderTree, />\+<|\},\s*"\+"\)/);
assert.doesNotMatch(noteTree, />\+<|\},\s*"\+"\)/);
