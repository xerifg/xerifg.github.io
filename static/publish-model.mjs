function stableTags(tags) {
  return Array.from(new Set((tags || []).map((tag) => String(tag || "").trim()).filter(Boolean))).sort();
}

function comparableAsset(asset) {
  return {
    id: asset?.id || "",
    name: asset?.name || asset?.fileName || "",
    mimeType: asset?.mimeType || "",
    size: asset?.size || 0,
    remotePath: asset?.remotePath || ""
  };
}

function comparableHtml(note) {
  return (note?.assets || []).reduce((html, asset) => {
    if (!asset?.remotePath) return html;
    return [asset.localUrl, asset.dataUrl]
      .filter((url) => typeof url === "string" && url)
      .reduce((nextHtml, url) => nextHtml.split(url).join(asset.remotePath), html);
  }, note?.html || "");
}

function comparableAssets(note) {
  const html = comparableHtml(note);
  return (note?.assets || [])
    .filter((asset) => asset?.remotePath && html.includes(asset.remotePath))
    .map(comparableAsset);
}

function comparableNote(note) {
  return {
    title: note?.title || "",
    folderId: note?.folderId || null,
    tags: stableTags(note?.tags),
    html: comparableHtml(note),
    assets: comparableAssets(note)
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

function slugify(value) {
  const slug = String(value || "untitled")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `note-${Date.now()}`;
}

function trimSlash(path) {
  return String(path || "").replace(/^\/+|\/+$/g, "");
}

function fileSlug(path) {
  return trimSlash(path).split("/").pop()?.replace(/\.json$/i, "").toLowerCase() || "";
}

function isUntitledDocumentFile(path) {
  return ["未命名文档", "untitled", "untitled-document"].includes(fileSlug(path));
}
function textFromHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function diffTextFromHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/blockquote|\/pre)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

export function buildUnifiedTextDiff(remoteText, localText, contextLines = 1) {
  const remoteLines = String(remoteText || "").split(/\r?\n/).filter(Boolean);
  const localLines = String(localText || "").split(/\r?\n/).filter(Boolean);
  const table = Array.from({ length: remoteLines.length + 1 }, () => Array(localLines.length + 1).fill(0));
  for (let remoteIndex = remoteLines.length - 1; remoteIndex >= 0; remoteIndex -= 1) {
    for (let localIndex = localLines.length - 1; localIndex >= 0; localIndex -= 1) {
      table[remoteIndex][localIndex] = remoteLines[remoteIndex] === localLines[localIndex]
        ? table[remoteIndex + 1][localIndex + 1] + 1
        : Math.max(table[remoteIndex + 1][localIndex], table[remoteIndex][localIndex + 1]);
    }
  }

  const operations = [];
  let remoteIndex = 0;
  let localIndex = 0;
  while (remoteIndex < remoteLines.length || localIndex < localLines.length) {
    if (remoteLines[remoteIndex] === localLines[localIndex]) {
      operations.push({ type: "context", oldLine: remoteIndex + 1, newLine: localIndex + 1, text: remoteLines[remoteIndex] });
      remoteIndex += 1;
      localIndex += 1;
    } else if (localIndex >= localLines.length || (remoteIndex < remoteLines.length && table[remoteIndex + 1][localIndex] >= table[remoteIndex][localIndex + 1])) {
      operations.push({ type: "remove", oldLine: remoteIndex + 1, newLine: null, text: remoteLines[remoteIndex] });
      remoteIndex += 1;
    } else {
      operations.push({ type: "add", oldLine: null, newLine: localIndex + 1, text: localLines[localIndex] });
      localIndex += 1;
    }
  }

  const changedIndexes = operations.flatMap((operation, index) => operation.type === "context" ? [] : [index]);
  const added = operations.filter((operation) => operation.type === "add").length;
  const removed = operations.filter((operation) => operation.type === "remove").length;
  if (!changedIndexes.length) return { added, removed, hunks: [] };

  const ranges = [];
  for (const index of changedIndexes) {
    const start = Math.max(0, index - contextLines);
    const end = Math.min(operations.length, index + contextLines + 1);
    const previous = ranges.at(-1);
    if (previous && start <= previous.end) previous.end = Math.max(previous.end, end);
    else ranges.push({ start, end });
  }
  return {
    added,
    removed,
    hunks: ranges.map(({ start, end }) => {
      const lines = operations.slice(start, end);
      return {
        oldStart: lines.find((line) => line.oldLine !== null)?.oldLine || 0,
        oldLines: lines.filter((line) => line.oldLine !== null).length,
        newStart: lines.find((line) => line.newLine !== null)?.newLine || 0,
        newLines: lines.filter((line) => line.newLine !== null).length,
        lines
      };
    })
  };
}

function previewText(value, fallback = "无") {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  return text.length > 180 ? `${text.slice(0, 180)}...` : text;
}

function folderSummary(folders) {
  const byId = new Map((folders || []).map((folder) => [folder.id, folder]));
  const pathFor = (folder) => {
    const names = [];
    let current = folder;
    const seen = new Set();
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      names.unshift(current.name || current.id || "未命名目录");
      current = current.parentId ? byId.get(current.parentId) : null;
    }
    return names.join(" / ");
  };
  return (folders || []).map(pathFor).sort().join("\n") || "无目录";
}

function assetSummary(assets) {
  return (assets || [])
    .map((asset) => asset.remotePath || asset.name || asset.id || "未命名附件")
    .sort()
    .join("\n") || "无附件";
}

function pushDetail(details, label, remote, local, summary = "") {
  if (sameValue(remote, local)) return;
  details.push({
    label,
    remote: previewText(remote),
    local: previewText(local),
    summary
  });
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

export function buildMissingRemoteNote(summary, fallbackDate) {
  const tags = stableTags(summary?.tags);
  return {
    id: summary.id,
    title: summary.title || "Untitled document",
    folderId: summary.folderId || null,
    tags,
    date: summary.updatedAt || fallbackDate,
    file: summary.file,
    dirty: false,
    publishedAt: summary.updatedAt || "",
    assets: [],
    html: "",
    missingRemote: true
  };
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
      changes.push({ id: noteChangeId(note.id), kind: "note", action: "create", noteId: note.id, title: note.title || "未命名文档" });
    } else if (!sameValue(comparableNote(note), comparableNote(remote))) {
      changes.push({ id: noteChangeId(note.id), kind: "note", action: "update", noteId: note.id, title: note.title || "未命名文档" });
    }
  }

  for (const note of remoteNotes) {
    if (!localById.has(note.id)) {
      changes.push({ id: noteChangeId(note.id), kind: "note", action: "delete", noteId: note.id, title: note.title || "未命名文档" });
    }
  }

  if (!sameValue(localState.folders || [], remoteState.folders || [])) {
    changes.push({ id: "folders", kind: "folders", action: "update", title: "目录结构" });
  }
  if (!sameValue(stableTags(localState.deletedTags), stableTags(remoteState.deletedTags))) {
    changes.push({ id: "tags", kind: "tags", action: "delete", title: "已删除标签", requires: changes.filter((change) => change.kind === "note" && change.action !== "delete" && !sameValue(stableTags(localById.get(change.noteId)?.tags), stableTags(remoteById.get(change.noteId)?.tags))).map((change) => change.id) });
  }

  return { changes, selectedIds: changes.map((change) => change.id) };
}


export function buildPublishChangeDetails(localState, remoteState, change) {
  if (!change) return [];
  if (change.kind === "folders") {
    return [{
      label: "目录",
      remote: folderSummary(remoteState.folders || []),
      local: folderSummary(localState.folders || []),
      summary: "线上目录结构 -> 本地目录结构"
    }];
  }
  if (change.kind === "tags") {
    return [{
      label: "已删除标签",
      remote: stableTags(remoteState.deletedTags).join("、") || "无",
      local: stableTags(localState.deletedTags).join("、") || "无",
      summary: "本地标签删除记录将写入线上索引"
    }];
  }
  if (change.kind !== "note") return [];

  const local = (localState.notes || []).find((note) => note.id === change.noteId);
  const remote = (remoteState.notes || []).find((note) => note.id === change.noteId);
  const localComparable = comparableNote(local || {});
  const remoteComparable = comparableNote(remote || {});
  const details = [];

  if (remote?.missingRemote) {
    details.push({
      label: "远端详情",
      remote: "未加载：只读取到线上索引摘要，未能读取文档正文和附件",
      local: "本地待发表内容可用",
      summary: "无法确认远端正文和附件，请检查远端文档文件是否存在或稍后重试"
    });
  }

  pushDetail(details, "标题", remoteComparable.title, localComparable.title);
  pushDetail(details, "目录", remoteComparable.folderId || "根目录", localComparable.folderId || "根目录");
  pushDetail(details, "标签", remoteComparable.tags.join("、"), localComparable.tags.join("、"));

  const remoteUnavailable = Boolean(remote?.missingRemote);
  const remoteText = textFromHtml(remoteComparable.html);
  const localText = textFromHtml(localComparable.html);
  if (!sameValue(remoteComparable.html, localComparable.html)) {
    const remoteDiffText = diffTextFromHtml(remoteComparable.html);
    const localDiffText = diffTextFromHtml(localComparable.html);
    details.push({
      label: "正文",
      remote: remoteUnavailable ? "未加载" : previewText(remoteText),
      local: previewText(localText),
      diff: remoteUnavailable ? null : buildUnifiedTextDiff(remoteDiffText, localDiffText),
      summary: remoteUnavailable
        ? "远端正文未能读取，无法计算完整正文差异"
        : `文本长度 ${remoteText.length} -> ${localText.length}，HTML 长度 ${remoteComparable.html.length} -> ${localComparable.html.length}`
    });
  }

  const remoteAssets = remoteUnavailable ? "未加载" : assetSummary(remoteComparable.assets);
  const localAssets = assetSummary(localComparable.assets);
  if (!sameValue(remoteAssets, localAssets)) {
    details.push({
      label: "附件",
      remote: previewText(remoteAssets),
      local: previewText(localAssets),
      summary: remoteUnavailable ? "远端附件未能读取，无法确认线上已有附件" : ""
    });
  }

  if (change.action === "create" && !details.length) {
    details.push({ label: "新建文档", remote: "无", local: previewText(localComparable.title), summary: "将创建新的线上文档" });
  }
  if (change.action === "delete" && !details.length) {
    details.push({ label: "删除文档", remote: previewText(remoteComparable.title), local: "无", summary: "将删除线上文档" });
  }
  return details;
}
export function revertDraftChange(localState, remoteState, change) {
  const next = clone(localState || {});
  if (!change) return next;
  const remoteById = new Map((remoteState?.notes || []).map((note) => [note.id, clone(note)]));
  if (change.kind === "note") {
    const remote = remoteById.get(change.noteId);
    if (change.action === "create") {
      next.notes = (next.notes || []).filter((note) => note.id !== change.noteId);
    } else if (change.action === "delete" && remote) {
      next.notes = [...(next.notes || []), remote];
    } else if (remote) {
      next.notes = (next.notes || []).map((note) => note.id === change.noteId ? remote : note);
    }
  }
  if (change.kind === "folders") next.folders = clone(remoteState?.folders || []);
  if (change.kind === "tags") next.deletedTags = clone(remoteState?.deletedTags || []);
  return next;
}

export function validatePublishSelection(changes, selectedIds) {
  const selected = new Set(selectedIds || []);
  const tags = (changes || []).find((change) => change.id === "tags");
  const missing = (tags?.requires || []).filter((id) => !selected.has(id));
  return missing.length ? { valid: false, missing } : { valid: true, missing: [] };
}

export function assignSelectedPublishFiles(selectedNotes, remoteNotes) {
  const remoteById = new Map((remoteNotes || []).map((note) => [note.id, note]));
  const usedFiles = new Set((remoteNotes || []).map((note) => trimSlash(note.file)).filter(Boolean));
  return (selectedNotes || []).map((note) => {
    const remote = remoteById.get(note.id);
    const preferred = trimSlash(note.file);
    const base = `notebooks/docs/${slugify(note.title || note.id || "untitled")}.json`;
    const shouldKeepRemote = remote?.file && !isUntitledDocumentFile(remote.file);
    if (shouldKeepRemote) return { ...note, file: remote.file };
    let candidate = preferred && !isUntitledDocumentFile(preferred) && !usedFiles.has(preferred) ? preferred : base;
    let counter = 2;
    while (usedFiles.has(candidate)) {
      candidate = `notebooks/docs/${slugify(note.title || note.id || "untitled")}-${counter}.json`;
      counter += 1;
    }
    usedFiles.add(candidate);
    return { ...note, file: candidate };
  });
}

export function mergeSelectedPublishState(localState, remoteState, selectedIds) {
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
