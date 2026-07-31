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
