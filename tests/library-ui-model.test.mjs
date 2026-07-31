import assert from "node:assert/strict";
import {
  DEFAULT_UI_PREFERENCES,
  buildKnowledgeAreas,
  buildLibrarySummary,
  buildTagBrowser,
  normalizeUiPreferences,
  resolveStartupState
} from "../static/library-ui-model.mjs";

assert.deepEqual(normalizeUiPreferences(), DEFAULT_UI_PREFERENCES);
assert.deepEqual(
  resolveStartupState({ view: "library", activeId: "note-1" }, DEFAULT_UI_PREFERENCES),
  { view: "home", activeId: "", selectedTag: "" }
);
assert.deepEqual(
  resolveStartupState(
    { view: "library", activeId: "note-1", selectedTag: "AI" },
    { ...DEFAULT_UI_PREFERENCES, rememberLastLocation: true }
  ),
  { view: "library", activeId: "note-1", selectedTag: "AI" }
);

const folders = [
  { id: "models", name: "妯″瀷鐮旂┒", parentId: null },
  { id: "tools", name: "宸ョ▼瀹炶返", parentId: null }
];
const notes = [
  { id: "vit", title: "ViT", folderId: "models", tags: ["AI", "Vision"], date: "2026-07-31" },
  { id: "bert", title: "BERT", folderId: "models", tags: ["AI", "NLP"], date: "2026-07-30" },
  { id: "docker", title: "Docker", folderId: "tools", tags: ["Tool"], date: "2026-07-29" }
];

assert.deepEqual(buildLibrarySummary(folders, notes), { folders: 2, notes: 3, tags: 4 });
assert.equal(buildKnowledgeAreas(folders, notes)[0].count, 2);
assert.deepEqual(
  buildTagBrowser(notes, { query: "a", sort: "popular", selectedTag: "AI" }).selected.noteIds,
  ["vit", "bert"]
);
