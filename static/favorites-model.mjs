export const FAVORITES_INDEX_PATH = "notebooks/favorites.json";

function noteId(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeFavorites(value = {}) {
  const seen = new Set();
  const noteIds = [];
  for (const valueId of Array.isArray(value?.noteIds) ? value.noteIds : []) {
    const id = noteId(valueId);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    noteIds.push(id);
  }
  return {
    version: 1,
    updatedAt: typeof value?.updatedAt === "string" && Number.isFinite(Date.parse(value.updatedAt)) ? value.updatedAt : "",
    noteIds
  };
}

function updateFavorites(favorites, noteIds, timestamp) {
  const current = normalizeFavorites(favorites);
  const next = normalizeFavorites({ ...current, noteIds });
  const changed = current.noteIds.join("\u0000") !== next.noteIds.join("\u0000");
  return { ...next, updatedAt: changed ? timestamp || current.updatedAt : current.updatedAt, changed };
}

export function toggleFavorite(favorites, rawNoteId, timestamp = "") {
  const id = noteId(rawNoteId);
  const current = normalizeFavorites(favorites);
  if (!id) return { ...current, changed: false };
  const noteIds = current.noteIds.includes(id)
    ? current.noteIds.filter((item) => item !== id)
    : [...current.noteIds, id];
  return updateFavorites(current, noteIds, timestamp);
}

export function reorderFavorites(favorites, rawMovedId, rawBeforeId, timestamp = "") {
  const movedId = noteId(rawMovedId);
  const beforeId = noteId(rawBeforeId);
  const current = normalizeFavorites(favorites);
  if (!movedId || !beforeId || movedId === beforeId || !current.noteIds.includes(movedId) || !current.noteIds.includes(beforeId)) return { ...current, changed: false };
  const noteIds = current.noteIds.filter((id) => id !== movedId);
  noteIds.splice(noteIds.indexOf(beforeId), 0, movedId);
  return updateFavorites(current, noteIds, timestamp);
}

export function removeFavorite(favorites, rawNoteId, timestamp = "") {
  const id = noteId(rawNoteId);
  const current = normalizeFavorites(favorites);
  return updateFavorites(current, id ? current.noteIds.filter((item) => item !== id) : current.noteIds, timestamp);
}

export function resolveFavoriteNotes(favorites, notes = []) {
  const notesById = new Map((Array.isArray(notes) ? notes : []).map((note) => [note?.id, note]));
  return normalizeFavorites(favorites).noteIds.map((id) => notesById.get(id)).filter(Boolean);
}

export function hasFavoriteChanges(current, published) {
  return normalizeFavorites(current).noteIds.join("\u0000") !== normalizeFavorites(published).noteIds.join("\u0000");
}

export function filterFavoriteNotes(notes, query = "", tag = "", sort = "manual") {
  const text = query.trim().toLocaleLowerCase();
  const result = notes.filter(note => (!tag || (note.tags || []).includes(tag)) &&
    `${note.title} ${note.excerpt || ""} ${note.folderPath || ""} ${(note.tags || []).join(" ")}`.toLocaleLowerCase().includes(text));
  if (sort === "recent") result.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
  return result;
}

export function moveFavorite(favorites, id, targetId, timestamp = "") {
  const current = normalizeFavorites(favorites), ids = [...current.noteIds];
  const from = ids.indexOf(id), to = ids.indexOf(targetId);
  if (from < 0 || to < 0) return { ...current, changed: false };
  ids.splice(to, 0, ...ids.splice(from, 1));
  return updateFavorites(current, ids, timestamp);
}

export function restoreFavorites(favorites, removed, availableIds, timestamp = "") {
  const ids = [...normalizeFavorites(favorites).noteIds];
  for (const item of [...removed].sort((a, b) => a.index - b.index)) {
    if (availableIds.includes(item.id) && !ids.includes(item.id)) ids.splice(Math.min(item.index, ids.length), 0, item.id);
  }
  return updateFavorites(favorites, ids, timestamp);
}
