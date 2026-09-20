import assert from "node:assert/strict";
import { filterFavoriteNotes, moveFavorite, normalizeFavorites, restoreFavorites, removeFavorite, hasFavoriteChanges } from "../static/favorites-model.mjs";
import { navigatePrimaryView, resolveStartupState, notebookStateForPersistence } from "../static/library-ui-model.mjs";
import { buildPublishChangeDetails } from "../static/publish-model.mjs";

const notes = [
  { id: "a", title: "V-JEPA", excerpt: "掩码预测", tags: ["世界模型"], folderPath: "自动驾驶", date: "2026-09-18" },
  { id: "b", title: "Transformer", excerpt: "注意力", tags: ["大模型"], date: "2026-09-20" },
  { id: "c", title: "WA-JEPA", excerpt: "动作", tags: ["世界模型"], date: "2026-09-19" }
];
assert.deepEqual(filterFavoriteNotes(notes, "预测").map(n => n.id), ["a"]);
assert.equal(filterFavoriteNotes(notes, "自动驾驶").length, 1);
assert.equal(filterFavoriteNotes(notes, "vjepa", "不存在").length, 0);
assert.deepEqual(filterFavoriteNotes(notes, "", "世界模型", "recent").map(n => n.id), ["c", "a"]);
assert.deepEqual(notes.map(n => n.id), ["a", "b", "c"], "Recent sorting must not mutate manual ordering");
const favorites = normalizeFavorites({ noteIds: ["a", "b", "c"] });
assert.deepEqual(moveFavorite(favorites, "a", "b").noteIds, ["b", "a", "c"], "Dragging down one row must move it");
assert.deepEqual(moveFavorite(favorites, "c", "a").noteIds, ["c", "a", "b"]);
assert.deepEqual(moveFavorite(favorites, "a", "missing").noteIds, favorites.noteIds);
assert.deepEqual(favorites.noteIds, ["a", "b", "c"]);
const removed = [{ id: "a", index: 0 }, { id: "c", index: 2 }];
assert.deepEqual(restoreFavorites({ noteIds: ["b", "new"] }, removed, ["a", "b", "c", "new"]).noteIds, ["a", "b", "c", "new"]);
assert.deepEqual(restoreFavorites({ noteIds: ["b"] }, removed, ["b", "c"]).noteIds, ["b", "c"], "Undo must not resurrect deleted notes");
assert.deepEqual(restoreFavorites(favorites, removed, ["a", "b", "c"]).noteIds, ["a", "b", "c"], "Undo must not duplicate favorites");
assert.ok(hasFavoriteChanges(removeFavorite(favorites, "a"), favorites));
const details = buildPublishChangeDetails({ notes, favorites }, { notes, favorites: { noteIds: [] } }, { kind: "favorites" });
assert.match(details[0].local, /V-JEPA/);
assert.equal(details[0].remote, "无");
const state = { notes, favorites, favoritesDirty: true, favoritesView: { query: "掩码", tag: "世界模型", sort: "manual", scrollTop: 312 }, view: "favorites" };
assert.equal(navigatePrimaryView(state, "favorites").view, "favorites");
assert.equal(resolveStartupState(state).view, "favorites");
const persisted = notebookStateForPersistence(state);
assert.equal(persisted.favoritesDirty, true);
assert.deepEqual(persisted.favoritesView, state.favoritesView);
console.log("Workspace favorites: filtering, ordering, undo, navigation and local persistence passed");
