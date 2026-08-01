import assert from "node:assert/strict";
import {
  DEFAULT_UI_PREFERENCES,
  buildKnowledgeAreas,
  buildLibrarySummary,
  buildTagBrowser,
  normalizeUiPreferences,
  resolveStartupState
} from "../static/library-ui-model.mjs";

const drawerModel = await import("../static/library-ui-model.mjs");
assert.equal(typeof drawerModel.toggleContextDrawer, "function", "drawer toggling must be an executable state transition");
assert.equal(drawerModel.toggleContextDrawer(false), true, "the directory control opens a closed drawer");
assert.equal(drawerModel.toggleContextDrawer(true), false, "the directory control closes an open drawer");

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

assert.deepEqual(
  normalizeUiPreferences({ contentWidthRatio: 40, theme: "sepia", sidebarDensity: "compact" }),
  {
    ...DEFAULT_UI_PREFERENCES,
    contentWidthRatio: 50,
    theme: "auto",
    sidebarDensity: "compact"
  }
);
assert.deepEqual(
  normalizeUiPreferences({ contentWidthRatio: 120 }),
  { ...DEFAULT_UI_PREFERENCES, contentWidthRatio: 100 }
);
assert.deepEqual(
  normalizeUiPreferences({ contentWidthRatio: 76, translucentMaterials: false, showOutline: false, defaultMode: "edit" }),
  { ...DEFAULT_UI_PREFERENCES, contentWidthRatio: 76, translucentMaterials: false, showOutline: false, defaultMode: "edit" }
);
assert.equal(normalizeUiPreferences({ contentWidth: 760 }).contentWidthRatio, 76, "legacy pixel preferences should migrate to the equivalent canvas ratio");

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
assert.deepEqual(
  buildTagBrowser(notes, { sort: "name" }).records.map((tag) => tag.name),
  ["AI", "NLP", "Tool", "Vision"]
);

assert.deepEqual(
  buildLibrarySummary([], [
    { id: "one", tags: [" AI ", "ai", "Vision"] },
    { id: "two", tags: ["vision", ""] }
  ]),
  { folders: 0, notes: 2, tags: 2 }
);

assert.deepEqual(
  buildKnowledgeAreas(
    [
      { id: "research", name: "Research", parentId: null },
      { id: "vision", name: "Vision", parentId: "research" },
      { id: "vit", name: "ViT", parentId: "vision" }
    ],
    [
      { id: "overview", folderId: "research" },
      { id: "paper", folderId: "vit" }
    ]
  ),
  [{ id: "research", name: "Research", count: 2 }]
);

const browserNotes = [
  { id: "z1", tags: ["Zulu"] },
  { id: "z2", tags: ["zulu"] },
  { id: "b1", tags: ["Bravo"] },
  { id: "a1", tags: ["Alpha"] }
];

assert.deepEqual(
  buildTagBrowser(browserNotes, { sort: "popular" }).records.map(({ name, count }) => ({ name, count })),
  [
    { name: "Zulu", count: 2 },
    { name: "Alpha", count: 1 },
    { name: "Bravo", count: 1 }
  ]
);
assert.deepEqual(
  buildTagBrowser(browserNotes, { sort: "name" }).records.map((tag) => tag.name),
  ["Alpha", "Bravo", "Zulu"]
);
assert.deepEqual(
  buildTagBrowser(browserNotes, { query: "ra", selectedTag: "Zulu" }),
  { records: [{ name: "Bravo", count: 1, noteIds: ["b1"] }], selected: null }
);
assert.equal(buildTagBrowser(browserNotes, { selectedTag: "Missing" }).selected, null);

const originalLocaleLowerCase = String.prototype.toLocaleLowerCase;
try {
  String.prototype.toLocaleLowerCase = () => {
    throw new Error("host locale casing must not be used");
  };
  assert.deepEqual(
    buildTagBrowser([{ id: "i", tags: ["I"] }], { query: "i", selectedTag: "I" }),
    { records: [{ name: "I", count: 1, noteIds: ["i"] }], selected: { name: "I", count: 1, noteIds: ["i"] } }
  );
} finally {
  String.prototype.toLocaleLowerCase = originalLocaleLowerCase;
}
