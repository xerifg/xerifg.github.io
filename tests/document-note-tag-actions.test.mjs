import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyNoteTagMutation } from "../static/library-ui-model.mjs";

const noteScopedRename = applyNoteTagMutation(
  [
    { id: "active", date: "2026-08-01T10:00:00.000Z", tags: ["模型", "VoxelNet"] },
    { id: "other", date: "2026-08-01T09:00:00.000Z", tags: ["模型"] }
  ],
  {
    mode: "rename",
    noteId: "active",
    selectedTag: "模型",
    name: "算法模型",
    timestamp: "2026-08-01T11:00:00.000Z"
  }
);
assert.equal(noteScopedRename.changed, true);
assert.deepEqual(noteScopedRename.notes.map((note) => note.tags), [["VoxelNet", "算法模型"], ["模型"]]);
assert.equal(noteScopedRename.notes[0].dirty, true);
assert.equal(noteScopedRename.notes[0].date, "2026-08-01T11:00:00.000Z");

const noteScopedDelete = applyNoteTagMutation(
  [
    { id: "active", tags: ["模型", "VoxelNet"] },
    { id: "other", tags: ["模型"] }
  ],
  { mode: "delete", noteId: "active", selectedTag: "模型", timestamp: "2026-08-01T12:00:00.000Z" }
);
assert.equal(noteScopedDelete.changed, true);
assert.deepEqual(noteScopedDelete.notes.map((note) => note.tags), [["VoxelNet"], ["模型"]]);

const app = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../static/app.css", import.meta.url), "utf8");

const documentPaper = app.slice(app.indexOf("function DocumentPaper"), app.indexOf("function documentOutlineFromHtml"));

assert.match(
  documentPaper,
  /function DocumentPaper\(\{ note, state, editable, updateNote, handleAction \}\)/,
  "the document paper should receive local tag actions without changing static metadata"
);
assert.match(
  documentPaper,
  /ensureDefaultTags\(note\.tags\)\.map\(\(tag\) => renderNoteTagPill\(tag, note, editable, handleAction\)\)/,
  "document tags should receive the current editability when rendered"
);
assert.match(
  app,
  /function renderNoteTagPill\(tag, note, editable, handleAction\)/,
  "the tag pill should know whether the document is editable"
);
assert.match(
  app,
  /editable \? h\("span", \{ className: "note-tag-actions", "aria-hidden": "false" \}/,
  "read-mode tag pills must not render rename or delete actions"
);

const staticMetaSource = documentPaper.slice(
  documentPaper.indexOf('h("span", { className: "pill" }, folderPath'),
  documentPaper.indexOf('h("div", { className: "tiptap-shell" }')
);
assert.match(staticMetaSource, /folderPath\(state, note\.folderId\).*className:\s*"pill"/s);
assert.match(staticMetaSource, /note\.dirty \? "本地草稿" : "已发�?/);
assert.match(staticMetaSource, /formatDate\(note\.date\)/);
assert.doesNotMatch(staticMetaSource, /rename-folder-tag|delete-folder-tag|rename-publish|delete-publish/);

assert.match(app, /if \(action === "rename-note-tag"\) \{/);
assert.match(app, /if \(action === "delete-note-tag"\) \{/);
assert.match(app, /applyNoteTagMutation\(state\.notes/);
assert.match(app, /mode:\s*"delete"[\s\S]*noteId:\s*note\?\.id[\s\S]*selectedTag:\s*targetFolderId/);

assert.match(css, /\.note-tag-pill\s*\{/);
assert.match(css, /\.note-tag-action\s*\{/);
assert.match(css, /\.note-tag-pill:hover\s+\.note-tag-action/);
assert.match(css, /\.note-tag-delete:hover/);
