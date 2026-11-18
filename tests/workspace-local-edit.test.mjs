import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as model from "../static/library-ui-model.mjs";
import { templateContent, openWorkspaceNote } from "../static/knowledge-model.mjs";

assert.equal(typeof model.canEditNotebook, "function");
for (const hostname of ["localhost", "127.0.0.1", "[::1]"]) {
  assert.equal(model.canEditNotebook(false, { protocol: "http:", hostname }), true);
}
for (const hostname of ["xerifg.github.io", "localhost.example.com", "127.0.0.1.example.com", "192.168.1.10", ""]) {
  assert.equal(model.canEditNotebook(false, { protocol: "http:", hostname }), false);
}
assert.equal(model.canEditNotebook(false, { protocol: "file:", hostname: "localhost" }), false);
assert.equal(model.canEditNotebook(false), false);
assert.equal(model.canEditNotebook(true), true);

const source = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
const start = source.indexOf("  const hasEditSession =");
const end = source.indexOf("  const selectNote =", start);
for (const [hostname, authenticated, permitted] of [["127.0.0.1", false, true], ["xerifg.github.io", false, false], ["xerifg.github.io", true, true]]) {
  const state = { authenticated };
  const context = vm.createContext({ state, window: { location: { protocol: "http:", hostname } }, canEditNotebook: model.canEditNotebook, patchState: recipe => recipe(state), setToast: () => {} });
  vm.runInContext(source.slice(start, end), context);
  assert.equal(vm.runInContext('requireEditPermission("edit")', context), permitted);
  assert.equal(vm.runInContext('requireEditPermission("publish")', context), authenticated, "local editing must not impersonate a cloud login");
  assert.equal(state.authenticated, authenticated);
}
const state = { authenticated: false, folders: [{ id: "models", name: "3D检测模型", parentId: null }], notes: [{ id: "old", folderId: "models", html: "<p>原文档</p>" }], modalContext: { folderId: "models" }, collapsedFolders: {}, workspace: {} };
const context = vm.createContext({
  state, window: { location: { protocol: "http:", hostname: "127.0.0.1" } },
  canEditNotebook: model.canEditNotebook, patchState: recipe => recipe(state), setToast: () => {},
  document: { querySelector: () => ({ value: "信息" }) }, crypto, templateContent, openWorkspaceNote,
  now: () => new Date().toISOString(), slugify: value => value, setToolsView: () => {},
  historyRef: { current: new Map([["old", true]]) }, structuredClone, draftAssetStore: {}, saveSnapshot: async () => {}
});
vm.runInContext(source.slice(start, end), context);
for (const [from, to] of [
  ["  const updateNote =", "  const createFolder ="],
  ["  const createFolder =", "  const createNote ="],
  ["  const createNote =", "  const openDaily ="]
]) vm.runInContext(source.slice(source.indexOf(from), source.indexOf(to)), context);
vm.runInContext('createFolder(); createNote(state.folders.at(-1).id); updateNote(state.activeId, note => { note.html = "<p>本地测试内容</p>"; });', context);
assert.equal(state.folders.at(-1).parentId, "models");
assert.equal(state.notes[0].folderId, state.folders.at(-1).id);
assert.equal(state.notes[0].html, "<p>本地测试内容</p>");
assert.equal(state.notes[1].html, "<p>原文档</p>");
assert.equal(state.mode, "edit");
assert.equal(state.authenticated, false);
assert.match(source, /editable: state\.mode === "edit" && hasEditSession/);
assert.match(source, /sources: state\.sources, canEdit: hasEditSession/);
assert.match(source, /HistoryDialog, \{ note, canRestore: hasEditSession/);
assert.match(source, /BackupDialog, \{ state, store: draftAssetStore, canRestore: hasEditSession/);
console.log("Local editing: loopback access, online login enforcement and cloud publish isolation verified");
