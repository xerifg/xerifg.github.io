export const DEFAULT_UI_PREFERENCES = Object.freeze({
  rememberLastLocation: false,
  theme: "auto",
  sidebarDensity: "comfortable",
  translucentMaterials: true,
  contentWidth: 760,
  showOutline: true,
  defaultMode: "read"
});

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

export function buildTagBrowser(notes = [], options = {}) {
  const tags = new Map();
  for (const note of notes) {
    for (const rawTag of noteTags(note)) {
      const name = typeof rawTag === "string" ? rawTag.trim() : "";
      const key = normalizedTag(rawTag);
      if (!key) continue;
      if (!tags.has(key)) tags.set(key, { name, count: 0, noteIds: [] });
      const tag = tags.get(key);
      tag.count += 1;
      tag.noteIds.push(note.id);
    }
  }

  const query = String(options.query || "").trim().toLowerCase();
  const records = [...tags.values()].filter((tag) => tag.name.toLowerCase().includes(query));
  const byName = (left, right) => left.name.localeCompare(right.name, "zh-CN");
  records.sort(options.sort === "name" ? byName : (left, right) => right.count - left.count || byName(left, right));

  const selectedKey = normalizedTag(options.selectedTag);
  return {
    records,
    selected: records.find((tag) => normalizedTag(tag.name) === selectedKey) || null
  };
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

export function buildTagReturnContext(state) {
  return {
    selectedTag: state.selectedTag || "",
    query: state.tagQuery || "",
    sort: state.tagSort === "name" ? "name" : "popular"
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
