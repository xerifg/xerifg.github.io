function stableTags(tags) {
  return Array.from(new Set((tags || []).map((tag) => String(tag || "").trim()).filter(Boolean))).sort();
}

function comparableAsset(asset) {
  return {
    id: asset?.id || "",
    name: asset?.name || asset?.fileName || "",
    mimeType: asset?.mimeType || "",
    size: asset?.size || 0,
    remotePath: asset?.remotePath || "",
    remoteUrl: asset?.remoteUrl || "",
    localUrl: asset?.localUrl || ""
  };
}

function comparableNote(note) {
  return {
    title: note?.title || "",
    folderId: note?.folderId || null,
    tags: stableTags(note?.tags),
    html: note?.html || "",
    assets: (note?.assets || []).map(comparableAsset)
  };
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function clone(value) {
  return structuredClone(value);
}

function noteChangeId(noteId) {
  return `note:${noteId}`;
}

function foldersRequiredForSelectedNotes(localState, remoteState, selectedIds, changeById) {
  const foldersChanged = !sameValue(localState.folders || [], remoteState.folders || []);
  if (!foldersChanged) return false;
  const localFolders = new Map((localState.folders || []).map((folder) => [folder.id, folder]));
  const remoteFolders = new Map((remoteState.folders || []).map((folder) => [folder.id, folder]));
  const changedFolderIds = new Set([
    ...Array.from(localFolders.keys()),
    ...Array.from(remoteFolders.keys())
  ].filter((folderId) => !sameValue(localFolders.get(folderId), remoteFolders.get(folderId))));
  return Array.from(selectedIds).some((id) => {
    const change = changeById.get(id);
    if (!change || change.kind !== "note" || change.action === "delete") return false;
    const note = (localState.notes || []).find((item) => item.id === change.noteId);
    let folderId = note?.folderId;
    while (folderId) {
      if (changedFolderIds.has(folderId)) return true;
      folderId = localFolders.get(folderId)?.parentId || null;
    }
    return false;
  });
}

export function buildPublishChangeSet(localState, remoteState) {
  const localNotes = localState.notes || [];
  const remoteNotes = remoteState.notes || [];
  const remoteById = new Map(remoteNotes.map((note) => [note.id, note]));
  const localById = new Map(localNotes.map((note) => [note.id, note]));
  const changes = [];

  for (const note of localNotes) {
    const remote = remoteById.get(note.id);
    if (!remote) {
      changes.push({ id: noteChangeId(note.id), kind: "note", action: "create", noteId: note.id, title: note.title || "?????" });
    } else if (!sameValue(comparableNote(note), comparableNote(remote))) {
      changes.push({ id: noteChangeId(note.id), kind: "note", action: "update", noteId: note.id, title: note.title || "?????" });
    }
  }

  for (const note of remoteNotes) {
    if (!localById.has(note.id)) {
      changes.push({ id: noteChangeId(note.id), kind: "note", action: "delete", noteId: note.id, title: note.title || "?????" });
    }
  }

  if (!sameValue(localState.folders || [], remoteState.folders || [])) {
    changes.push({ id: "folders", kind: "folders", action: "update", title: "????" });
  }
  if (!sameValue(stableTags(localState.deletedTags), stableTags(remoteState.deletedTags))) {
    changes.push({ id: "tags", kind: "tags", action: "delete", title: "Tag deletions", requires: changes.filter((change) => change.kind === "note" && change.action !== "delete" && !sameValue(stableTags(localById.get(change.noteId)?.tags), stableTags(remoteById.get(change.noteId)?.tags))).map((change) => change.id) });
  }

  return { changes, selectedIds: changes.map((change) => change.id) };
}


export function validatePublishSelection(changes, selectedIds) {
  const selected = new Set(selectedIds || []);
  const tags = (changes || []).find((change) => change.id === "tags");
  const missing = (tags?.requires || []).filter((id) => !selected.has(id));
  return missing.length ? { valid: false, missing } : { valid: true, missing: [] };
}export function mergeSelectedPublishState(localState, remoteState, selectedIds) {
  const selected = new Set(selectedIds || []);
  const changeSet = buildPublishChangeSet(localState, remoteState);
  const changeById = new Map(changeSet.changes.map((change) => [change.id, change]));
  const remoteById = new Map((remoteState.notes || []).map((note) => [note.id, clone(note)]));
  const localById = new Map((localState.notes || []).map((note) => [note.id, note]));
  const selectedNotes = [];
  const deletedRemoteNotes = [];
  const includeDeletedTags = selected.has("tags");

  for (const change of changeSet.changes) {
    if (!selected.has(change.id) || change.kind !== "note") continue;
    const local = localById.get(change.noteId);
    const remote = remoteById.get(change.noteId);
    if (change.action === "delete") {
      if (remote) { remoteById.delete(change.noteId); deletedRemoteNotes.push(remote); }
      continue;
    }
    if (local) { const next = clone(local); remoteById.set(change.noteId, next); selectedNotes.push(next); }
  }
  const includeFolders = selected.has("folders") || foldersRequiredForSelectedNotes(localState, remoteState, selected, changeById);
  const remoteOrder = (remoteState.notes || []).map((note) => note.id);
  const createdIds = selectedNotes.map((note) => note.id).filter((id) => !remoteOrder.includes(id));
  const orderedIds = [...remoteOrder.filter((id) => remoteById.has(id)), ...createdIds];

  return {
    state: {
      folders: clone(includeFolders ? (localState.folders || []) : (remoteState.folders || [])),
      notes: orderedIds.map((id) => remoteById.get(id)),
      deletedTags: clone(includeDeletedTags ? (localState.deletedTags || []) : (remoteState.deletedTags || []))
    },
    selectedNotes,
    deletedRemoteNotes,
    includeFolders,
    includeDeletedTags
  };
}

export function reconcilePublishedNotes(localNotes, publishedNotes) {
  const publishedById = new Map((publishedNotes || []).map((note) => [note.id, note]));
  return (localNotes || []).map((note) => publishedById.get(note.id) || note);
}