import assert from "node:assert/strict";
import { noteHref, linkedNoteId, buildRelations, searchNotes, normalizeProperties, openWorkspaceNote, closeWorkspaceNote, dailyTitle, templateContent, validateBackup, mergeBackup } from "../static/knowledge-model.mjs";

const notes = [
  { id: "a", title: "世界模型", tags: ["视觉"], html: '<p>比较 <a href="#note/b">旧标题</a> 的预测目标。</p>' },
  { id: "b", title: "V-JEPA", tags: ["视觉"], html: "<h2>特征预测</h2><p>潜在空间学习</p>" },
  { id: "c", title: "实验", tags: [], html: '<pre>&lt;a href="#note/b"&gt;</pre>' }
];
assert.equal(linkedNoteId(noteHref("a/中文")), "a/中文");
assert.equal(linkedNoteId("https://evil.test/#note/a"), null);
assert.equal(linkedNoteId("#note/%XX"), null);
assert.deepEqual(buildRelations(notes, "b").incoming.map(n => n.id), ["a"]);
assert.equal(buildRelations(notes, "a").outgoing[0].title, "V-JEPA");
assert.equal(buildRelations(notes.slice(0, 1), "a").missing[0], "b");
assert.equal(searchNotes(notes, "潜在")[0].note.id, "b");
assert.equal(searchNotes(notes, 'tag:视觉 预测').length, 2);
assert.equal(searchNotes(notes, '"特征预测"')[0].note.id, "b");
assert.equal(searchNotes(notes, 'tag:视觉 -V-JEPA').length, 1);
assert.deepEqual(normalizeProperties({ type: "论文", status: "在读", source: "javascript:alert(1)", aliases: ["别名", "别名"] }), { type: "论文", status: "在读", source: "", aliases: ["别名"] });
let workspace = openWorkspaceNote({}, "a", notes);
workspace = openWorkspaceNote(workspace, "b", notes);
workspace = openWorkspaceNote(workspace, "a", notes);
assert.deepEqual(workspace.tabs, ["a", "b"]);
assert.equal(closeWorkspaceNote(workspace, "a").activeId, "b");
assert.equal(dailyTitle(new Date(2026, 8, 18, 23)), "2026-09-18");
assert.match(templateContent("paper", "2026-09-18").html, /研究问题/);
assert.match(templateContent("daily", "2026-09-18").html, /今日记录/);
assert.throws(() => validateBackup({ version: 1, notes: [{ id: "a" }, { id: "a" }], folders: [] }));
assert.throws(() => validateBackup({ version: 1, notes: [], folders: [{ id: "x", parentId: "x" }] }));
const backup = validateBackup({ version: 1, notes: [{ ...notes[0], properties: { type: "概念" } }], folders: [] });
const merged = mergeBackup({ notes, folders: [] }, backup);
assert.equal(merged.notes.length, 3, "Restore must not delete notes absent from backup");
assert.equal(merged.notes.find(n => n.id === "a").dirty, true);
console.log("knowledge model tests passed");
