import assert from "node:assert/strict";
import { applyTreeDrop } from "../static/tree-dnd.mjs";

const source = {
  folders: [
    { id: "tools", name: "Tools", parentId: null },
    { id: "projects", name: "Projects", parentId: null },
    { id: "robot", name: "Robot", parentId: "projects" }
  ],
  notes: [
    { id: "sdk", title: "SDK", folderId: "tools" },
    { id: "docker", title: "Docker", folderId: "tools" },
    { id: "model", title: "Model", folderId: "robot" }
  ]
};

{
  const result = applyTreeDrop(source, { type: "folder", id: "tools" }, { type: "folder", id: "projects", position: "after" });
  assert.equal(result.changed, true);
  assert.deepEqual(result.folders.map((folder) => folder.id), ["projects", "tools", "robot"]);
}

{
  const result = applyTreeDrop(source, { type: "note", id: "sdk" }, { type: "folder", id: "robot", position: "inside" });
  assert.equal(result.changed, true);
  assert.equal(result.notes.at(-1).id, "sdk");
  assert.equal(result.notes.at(-1).folderId, "robot");
}

{
  const result = applyTreeDrop(source, { type: "note", id: "sdk" }, { type: "note", id: "model", position: "before" });
  assert.equal(result.changed, true);
  assert.deepEqual(result.notes.map((note) => note.id), ["docker", "sdk", "model"]);
  assert.equal(result.notes[1].folderId, "robot");
}

{
  const result = applyTreeDrop(source, { type: "folder", id: "projects" }, { type: "folder", id: "robot", position: "inside" });
  assert.equal(result.changed, false);
  assert.equal(result.reason, "descendant-folder");
  assert.deepEqual(result.folders, source.folders);
}
