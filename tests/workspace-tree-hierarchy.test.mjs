import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Execute the actual tree renderer without loading the browser editor dependencies.
const source = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
const context = vm.createContext({
  h: (type, props, ...children) => ({ type, props, children: children.flat(Infinity).filter(Boolean) }),
  icon: () => null
});
for (const [start, end] of [
  ["function renderTree(", "function tableSelectionInfo("],
  ["function renderNoteItem(", "function buildDraftDeletionSummary("],
  ["function countNotes(", "function normalizeBlocks("]
]) {
  vm.runInContext(source.slice(source.indexOf(start), source.indexOf(end)), context);
}
const folders = [
  { id: "root", name: "Notebooks", parentId: null },
  { id: "driving", name: "自动驾驶", parentId: "root" },
  { id: "models", name: "3D检测模型", parentId: "driving" },
  { id: "info", name: "信息", parentId: "models" },
  { id: "deep", name: "深层目录", parentId: "info" }
];
const notes = [
  { id: "old", title: "CMT模型", folderId: "models" },
  { id: "new", title: "新文档", folderId: "info", html: "<p>输入内容</p>" },
  { id: "deep-note", title: "深层文档", folderId: "deep" }
];
context.state = { folders, notes, activeId: "new", query: "", collapsedFolders: {} };
const before = JSON.stringify(context.state);
const tree = vm.runInContext('renderTree(state, state.notes, () => {}, () => {}, { disabled: true }, null, {})', context);
const rows = new Map();
function visit(node, parentId = null) {
  const row = node.children?.find(child => child.props?.["data-tree-id"]);
  if (row) {
    rows.set(row.props["data-tree-id"], { props: row.props, parentId });
    parentId = row.props["data-tree-id"];
  }
  for (const child of node.children || []) if (typeof child === "object") visit(child, parentId);
}
tree.forEach(node => visit(node));
for (const note of notes) assert.equal(rows.get(note.id).parentId, note.folderId);
for (const [id, depth] of [["models", 2], ["old", 3], ["info", 3], ["new", 4], ["deep", 4], ["deep-note", 5]]) {
  const props = rows.get(id).props;
  const visualDepth = props.style?.["--tree-depth"] ?? Number(props.className.match(/indent-(\d+)/)[1]);
  assert.equal(visualDepth, depth, `${id} must retain its full visual depth`);
  assert.equal(rows.get(id).props["aria-level"], depth + 1);
}
assert.equal(JSON.stringify(context.state), before, "rendering must not move or modify notes");
const css = readFileSync(new URL("../static/workspace.css", import.meta.url), "utf8");
assert.match(css, /padding-left:\s*calc\(8px\s*\+\s*var\(--tree-depth\)\s*\*\s*8px\)/);
console.log("Tree hierarchy: parent notes retained, full nested depth and document ownership verified");
