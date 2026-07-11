function moveItem(items, fromIndex, toIndex) {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function isDescendantFolder(folders, folderId, possibleDescendantId) {
  let current = folders.find((folder) => folder.id === possibleDescendantId);
  while (current?.parentId) {
    if (current.parentId === folderId) return true;
    current = folders.find((folder) => folder.id === current.parentId);
  }
  return false;
}

function unchanged(state, reason = "no-change") {
  return { folders: state.folders, notes: state.notes, changed: false, reason };
}

export function applyTreeDrop(state, dragged, target) {
  if (!dragged?.id || !target?.id || dragged.id === target.id) return unchanged(state, "invalid-target");

  if (dragged.type === "folder") {
    const draggedIndex = state.folders.findIndex((folder) => folder.id === dragged.id);
    const targetIndex = state.folders.findIndex((folder) => folder.id === target.id);
    if (draggedIndex < 0 || targetIndex < 0 || target.type !== "folder") return unchanged(state, "invalid-target");
    if (isDescendantFolder(state.folders, dragged.id, target.id)) return unchanged(state, "descendant-folder");
    if (target.position !== "before" && target.position !== "after") return unchanged(state, "invalid-target");

    const folders = state.folders.map((folder) => ({ ...folder }));
    const [draggedFolder] = folders.splice(draggedIndex, 1);
    const adjustedTargetIndex = folders.findIndex((folder) => folder.id === target.id);
    const insertionIndex = target.position === "after" ? adjustedTargetIndex + 1 : adjustedTargetIndex;
    draggedFolder.parentId = state.folders[targetIndex].parentId || null;
    folders.splice(insertionIndex, 0, draggedFolder);

    return { folders, notes: state.notes, changed: true, reason: "moved" };
  }

  if (dragged.type !== "note") return unchanged(state, "invalid-target");
  const draggedIndex = state.notes.findIndex((note) => note.id === dragged.id);
  if (draggedIndex < 0) return unchanged(state, "invalid-target");

  const notes = state.notes.map((note) => ({ ...note }));
  const [draggedNote] = notes.splice(draggedIndex, 1);
  let insertionIndex = -1;
  let destinationFolderId = null;

  if (target.type === "folder" && target.position === "inside") {
    if (!state.folders.some((folder) => folder.id === target.id)) return unchanged(state, "invalid-target");
    destinationFolderId = target.id;
    insertionIndex = notes.reduce((last, note, index) => note.folderId === destinationFolderId ? index : last, -1) + 1;
  } else if (target.type === "note" && (target.position === "before" || target.position === "after")) {
    const targetIndex = notes.findIndex((note) => note.id === target.id);
    if (targetIndex < 0) return unchanged(state, "invalid-target");
    destinationFolderId = notes[targetIndex].folderId || null;
    insertionIndex = target.position === "after" ? targetIndex + 1 : targetIndex;
  } else {
    return unchanged(state, "invalid-target");
  }

  draggedNote.folderId = destinationFolderId;
  notes.splice(insertionIndex, 0, draggedNote);
  const changed = notes.some((note, index) => note.id !== state.notes[index]?.id || note.folderId !== state.notes[index]?.folderId);
  return changed ? { folders: state.folders, notes, changed: true, reason: "moved" } : unchanged(state);
}
