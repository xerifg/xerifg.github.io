export const DEFAULT_UI_PREFERENCES = Object.freeze({
  rememberLastLocation: false,
  theme: "auto",
  sidebarDensity: "comfortable",
  translucentMaterials: true,
  contentWidth: 760,
  showOutline: true,
  defaultMode: "read"
});

export function toggleContextDrawer(isOpen) {
  return !Boolean(isOpen);
}

export function resolveLocalPersistenceStatus(event) {
  if (event === "start") return "saving";
  if (event === "failure") return "error";
  return "saved";
}

export function localPersistenceStatusText(status) {
  if (status === "saving") return "正在保存…";
  if (status === "error") return "保存失败";
  return "已自动保存";
}

export function notebookStateForPersistence(state = {}) {
  const {
    uiPreferences,
    authenticated,
    pendingAuthAction,
    modal,
    modalContext,
    openCreateMenu,
    syncStatus,
    message,
    ...notebookState
  } = state;
  return notebookState;
}

export function resolveMenuKeyboard(currentIndex, key, itemCount) {
  const count = Math.max(0, Number(itemCount) || 0);
  if (key === "Escape") return { close: true, focusIndex: currentIndex };
  if (!count) return { focusIndex: -1 };
  const safeIndex = currentIndex >= 0 && currentIndex < count ? currentIndex : -1;
  if (key === "ArrowDown") return { focusIndex: safeIndex < 0 ? 0 : (safeIndex + 1) % count };
  if (key === "ArrowUp") return { focusIndex: safeIndex < 0 ? count - 1 : (safeIndex - 1 + count) % count };
  if (key === "Home") return { focusIndex: 0 };
  if (key === "End") return { focusIndex: count - 1 };
  return { focusIndex: currentIndex };
}

export function normalizeUiPreferences(value = {}) {
  const contentWidth = Number(value.contentWidth);
  return {
    rememberLastLocation: value.rememberLastLocation === true,
    theme: ["auto", "light", "dark"].includes(value.theme) ? value.theme : "auto",
    sidebarDensity: value.sidebarDensity === "compact" ? "compact" : "comfortable",
    translucentMaterials: value.translucentMaterials !== false,
    contentWidth: Math.min(920, Math.max(640, Number.isFinite(contentWidth) ? contentWidth : 760)),
    showOutline: value.showOutline !== false,
    defaultMode: value.defaultMode === "edit" ? "edit" : "read"
  };
}

export function resolveStartupState(state = {}, preferences = DEFAULT_UI_PREFERENCES) {
  if (preferences.rememberLastLocation) {
    return {
      view: ["home", "library", "tags", "settings"].includes(state.view) ? state.view : "home",
      activeId: state.activeId || "",
      selectedTag: state.selectedTag || ""
    };
  }
  return { view: "home", activeId: "", selectedTag: "" };
}

function normalizedTag(tag) {
  return typeof tag === "string" ? tag.trim().toLowerCase() : "";
}

function noteTags(note) {
  return Array.isArray(note.tags) ? note.tags : [];
}

export function buildLibrarySummary(folders = [], notes = []) {
  const tags = new Set();
  for (const note of notes) {
    for (const tag of noteTags(note)) {
      const normalized = normalizedTag(tag);
      if (normalized) tags.add(normalized);
    }
  }
  return { folders: folders.length, notes: notes.length, tags: tags.size };
}

export function buildKnowledgeAreas(folders = [], notes = []) {
  const children = new Map();
  for (const folder of folders) {
    const parentId = folder.parentId;
    if (!children.has(parentId)) children.set(parentId, []);
    children.get(parentId).push(folder);
  }

  return folders
    .filter((folder) => folder.parentId == null)
    .map((folder) => {
      const descendantIds = new Set([folder.id]);
      const queue = [folder.id];
      while (queue.length) {
        const parentId = queue.shift();
        for (const child of children.get(parentId) || []) {
          descendantIds.add(child.id);
          queue.push(child.id);
        }
      }
      return {
        id: folder.id,
        name: folder.name,
        count: notes.filter((note) => descendantIds.has(note.folderId)).length
      };
    });
}

function tagTimestamp(note) {
  const value = typeof note?.date === "string" ? note.date.trim() : "";
  const time = Date.parse(value);
  return Number.isFinite(time) ? { value, time } : { value: "", time: Number.NEGATIVE_INFINITY };
}

export function buildTagBrowser(notes = [], options = {}) {
  const tags = new Map();
  let occurrencePosition = 0;
  notes.forEach((note) => {
    const timestamp = tagTimestamp(note);
    noteTags(note).forEach((rawTag) => {
      const name = typeof rawTag === "string" ? rawTag.trim() : "";
      const key = normalizedTag(rawTag);
      if (!key) return;
      if (!tags.has(key)) tags.set(key, { name, count: 0, noteIds: [], recentAt: "", recentTime: Number.NEGATIVE_INFINITY, recentPosition: Number.NEGATIVE_INFINITY });
      const tag = tags.get(key);
      tag.count += 1;
      tag.noteIds.push(note.id);
      const position = occurrencePosition;
      occurrencePosition += 1;
      if (timestamp.time > tag.recentTime || (timestamp.time === tag.recentTime && position > tag.recentPosition)) Object.assign(tag, { recentAt: timestamp.value, recentTime: timestamp.time, recentPosition: position });
    });
  });
  const query = String(options.query || "").trim().toLowerCase();
  const records = [...tags.values()].filter((tag) => tag.name.toLowerCase().includes(query));
  const byName = (left, right) => left.name.localeCompare(right.name, "zh-CN");

  const byRecent = (left, right) => right.recentTime - left.recentTime
    || right.recentPosition - left.recentPosition
    || byName(left, right);
  records.sort(options.sort === "name"
    ? byName
    : options.sort === "recent"
      ? byRecent
      : (left, right) => right.count - left.count || byName(left, right));
  const publicRecords = records.map(({ recentTime, recentPosition, recentAt, ...record }) => options.sort === "recent"
    ? { ...record, recentAt }
    : record);
  const selectedKey = normalizedTag(options.selectedTag);
  return {
    records: publicRecords,
    selected: publicRecords.find((tag) => normalizedTag(tag.name) === selectedKey) || null
  };
}

export function applyLocalTagMutation(notes = [], options = {}) {
  const name = typeof options.name === "string" ? options.name.trim() : "";
  const timestamp = typeof options.timestamp === "string" ? options.timestamp : "";
  if (!name) return { notes, changed: false, selectedTag: "", error: "empty-name" };
  if (options.mode === "create") {
    const noteIndex = notes.findIndex((note) => note.id === options.noteId);
    if (noteIndex < 0) return { notes, changed: false, selectedTag: "", error: "no-note" };
    const existing = noteTags(notes[noteIndex]).find((tag) => normalizedTag(tag) === normalizedTag(name));
    if (existing) return { notes, changed: false, selectedTag: existing, error: "duplicate" };
    const nextNotes = notes.map((note, index) => index === noteIndex
      ? { ...note, tags: [...noteTags(note), name], date: timestamp || note.date, dirty: true }
      : note);
    return { notes: nextNotes, changed: true, selectedTag: name, error: "" };
  }
  const selectedKey = normalizedTag(options.selectedTag);
  if (!selectedKey) return { notes, changed: false, selectedTag: "", error: "missing-tag" };
  let changed = false;
  const nextNotes = notes.map((note) => {
    if (!noteTags(note).some((tag) => normalizedTag(tag) === selectedKey)) return note;
    changed = true;
    const nextTags = noteTags(note).filter((tag) => {
      const key = normalizedTag(tag);
      return key !== selectedKey && key !== normalizedTag(name);
    });
    nextTags.push(name);
    return { ...note, tags: nextTags, date: timestamp || note.date, dirty: true };
  });
  return changed
    ? { notes: nextNotes, changed: true, selectedTag: name, error: "" }
    : { notes, changed: false, selectedTag: "", error: "missing-tag" };
}

const tagCategoryMatchers = Object.freeze({
  status: /^(状态|待办|进行中|完成|草稿|已发表|todo|doing|done|draft|published)$/i,
  tool: /^(工具|tool|github|git|docker|chrome|figma|vscode|npm|pnpm|yarn)$/i,
  technology: /^(ai|nlp|vision|tiptap|react|javascript|typescript|python|css|html|api|模型|人工智能|机器学习|深度学习|机器人|自动驾驶)$/i
});

export function groupTagRecords(records = []) {
  const groups = { technology: [], topic: [], tool: [], status: [] };
  for (const record of records) {
    const name = String(record?.name || "").trim();
    const category = tagCategoryMatchers.status.test(name)
      ? "status"
      : tagCategoryMatchers.tool.test(name)
        ? "tool"
        : tagCategoryMatchers.technology.test(name)
          ? "technology"
          : "topic";
    groups[category].push(record);
  }
  return groups;
}

export function enterTagView(state, tag, options = {}) {
  return {
    ...state,
    selectedTag: tag,
    tagQuery: options.clearQuery ? "" : state.tagQuery || "",
    view: "tags",
    mode: "read",
    modal: null,
    modalContext: null,
    openCreateMenu: null
  };
}

export function navigatePrimaryView(state, requestedView) {
  const view = ["home", "library", "tags", "settings"].includes(requestedView)
    ? requestedView
    : "home";
  return {
    ...state,
    view,
    selectedTag: view === "library" ? "" : state.selectedTag,
    modal: null,
    modalContext: null,
    openCreateMenu: null
  };
}

export function buildTagReturnContext(state) {
  return {
    selectedTag: state.selectedTag || "",
    query: state.tagQuery || "",
    sort: ["name", "recent"].includes(state.tagSort) ? state.tagSort : "popular"
  };
}

export function restoreTagView(state) {
  const context = state.tagReturnContext;
  if (!context) return state;
  return {
    ...state,
    view: "tags",
    selectedTag: context.selectedTag,
    tagQuery: context.query,
    tagSort: context.sort,
    tagReturnContext: null,
    modal: null,
    modalContext: null,
    openCreateMenu: null
  };
}

export function buildVisibleTreeItems(folders = [], notes = [], collapsedFolders = {}, options = {}) {
  const childFolders = new Map();
  for (const folder of folders) {
    const parentId = folder.parentId || null;
    if (!childFolders.has(parentId)) childFolders.set(parentId, []);
    childFolders.get(parentId).push(folder);
  }
  const notesByFolder = new Map();
  for (const note of notes) {
    const folderId = note.folderId || null;
    if (!notesByFolder.has(folderId)) notesByFolder.set(folderId, []);
    notesByFolder.get(folderId).push(note);
  }
  const items = [];
  const visibility = new Map();
  const hasVisibleNotes = (folderId) => {
    if (visibility.has(folderId)) return visibility.get(folderId);
    const visible = Boolean((notesByFolder.get(folderId) || []).length)
      || (childFolders.get(folderId) || []).some((child) => hasVisibleNotes(child.id));
    visibility.set(folderId, visible);
    return visible;
  };
  const visitFolder = (folder, parentId = null) => {
    if (options.isSearching && !hasVisibleNotes(folder.id)) return;
    const expanded = options.isSearching || !collapsedFolders[folder.id];
    items.push({ id: folder.id, type: "folder", parentId, expanded });
    if (!expanded) return;
    for (const note of notesByFolder.get(folder.id) || []) {
      items.push({ id: note.id, type: "note", parentId: folder.id });
    }
    for (const child of childFolders.get(folder.id) || []) visitFolder(child, folder.id);
  };
  for (const folder of childFolders.get(null) || []) visitFolder(folder);
  for (const note of notesByFolder.get(null) || []) items.push({ id: note.id, type: "note", parentId: null });
  return items;
}

export function resolveTreeKeyboard(items = [], currentId, key) {
  if (!items.length) return { focusId: "" };
  const index = Math.max(0, items.findIndex((item) => item.id === currentId));
  const current = items[index];
  if (key === "ArrowDown") return { focusId: items[Math.min(items.length - 1, index + 1)].id };
  if (key === "ArrowUp") return { focusId: items[Math.max(0, index - 1)].id };
  if (key === "Home") return { focusId: items[0].id };
  if (key === "End") return { focusId: items.at(-1).id };
  if (key === "ArrowRight" && current.type === "folder") {
    if (!current.expanded) return { focusId: current.id, toggleFolderId: current.id };
    const child = items[index + 1];
    if (child?.parentId === current.id) return { focusId: child.id };
  }
  if (key === "ArrowLeft") {
    if (current.type === "folder" && current.expanded) {
      return { focusId: current.id, toggleFolderId: current.id };
    }
    if (current.parentId) return { focusId: current.parentId };
  }
  return { focusId: current.id };
}

export function resolvePublishReviewReturnTarget(explicitTarget, previousFocus) {
  const isConnectedFocusable = (target) => target?.isConnected === true && typeof target.focus === "function";
  if (isConnectedFocusable(explicitTarget)) return explicitTarget;
  if (isConnectedFocusable(previousFocus)) return previousFocus;
  return null;
}
