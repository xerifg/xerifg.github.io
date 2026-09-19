export const noteHref = (id) => `#note/${encodeURIComponent(id)}`;
export function linkedNoteId(href) {
  if (!String(href || "").startsWith("#note/")) return null;
  try { return decodeURIComponent(href.slice(6)) || null; } catch { return null; }
}

export function textFromNote(html = "") {
  return String(html).replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}

export function noteLinks(html = "") {
  const clean = String(html).replace(/<(pre|code|script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  return [...new Set([...clean.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi)]
    .map(match => linkedNoteId(match[1])).filter(Boolean))];
}

export function buildRelations(notes, id) {
  const note = notes.find(item => item.id === id);
  const byId = new Map(notes.map(item => [item.id, item]));
  const ids = noteLinks(note?.html);
  return {
    incoming: notes.filter(item => item.id !== id && noteLinks(item.html).includes(id)),
    outgoing: ids.filter(target => byId.has(target)).map(target => byId.get(target)),
    missing: ids.filter(target => !byId.has(target))
  };
}

export function referenceExcerpt(note, targetId) {
  const blocks = String(note.html || "").split(/<\/(?:p|li|blockquote|h[1-6])>/i);
  return textFromNote(blocks.find(block => noteLinks(block).includes(targetId)) || note.html).slice(0, 150);
}

export function folderLabel(folders, id) {
  const parts = []; const seen = new Set();
  while (id && !seen.has(id)) {
    seen.add(id); const folder = folders.find(item => item.id === id);
    if (!folder) break;
    parts.unshift(folder.name); id = folder.parentId;
  }
  return parts.join(" / ");
}

export function searchNotes(notes, query = "", folders = []) {
  const tokens = String(query).toLocaleLowerCase().match(/(?:[^\s"]+"[^"]*"|"[^"]*"|\S+)/g) || [];
  return notes.map(note => {
    const text = textFromNote(note.html); const path = folderLabel(folders, note.folderId);
    const title = `${note.title} ${(note.properties?.aliases || []).join(" ")}`.toLocaleLowerCase();
    const all = `${title} ${text} ${path} ${(note.tags || []).join(" ")}`.toLocaleLowerCase();
    const matched = tokens.every(token => {
      const excluded = token.startsWith("-"); const value = (excluded ? token.slice(1) : token).replace(/"/g, "");
      const ok = value.startsWith("tag:") ? (note.tags || []).some(tag => tag.toLocaleLowerCase() === value.slice(4).replace(/^#/, ""))
        : value.startsWith("path:") ? path.toLocaleLowerCase().includes(value.slice(5)) : all.includes(value);
      return excluded ? !ok : ok;
    });
    const words = tokens.filter(t => !t.startsWith("-") && !t.includes(":")).map(t => t.replace(/"/g, ""));
    const offset = Math.max(0, text.toLocaleLowerCase().indexOf(words[0] || "") - 36);
    const score = words.reduce((sum, word) => sum + (title === word ? 100 : title.includes(word) ? 20 : 1), 0);
    return { note, matched, path, score, words, excerpt: `${offset ? "…" : ""}${text.slice(offset, offset + 160)}` };
  }).filter(result => result.matched).sort((a, b) => b.score - a.score || String(b.note.date || "").localeCompare(String(a.note.date || "")));
}

export function normalizeProperties(value = {}) {
  const source = String(value?.source || "").trim();
  return {
    type: ["论文", "实验", "概念", "项目", "日记"].includes(value?.type) ? value.type : "",
    status: ["待整理", "在读", "已整理", "已归档"].includes(value?.status) ? value.status : "",
    source: /^https?:\/\//i.test(source) ? source.slice(0, 2000) : "",
    aliases: [...new Set((Array.isArray(value?.aliases) ? value.aliases : []).filter(v => typeof v === "string").map(v => v.trim()).filter(Boolean))].slice(0, 20)
  };
}

export function openWorkspaceNote(workspace = {}, id, notes) {
  const valid = new Set(notes.map(note => note.id));
  return { ...workspace, tabs: [...new Set([...(workspace.tabs || []), id])].filter(key => valid.has(key)),
    recent: [id, ...(workspace.recent || []).filter(key => key !== id)].filter(key => valid.has(key)).slice(0, 20), activeId: id };
}
export function closeWorkspaceNote(workspace, id) {
  const index = workspace.tabs.indexOf(id); const tabs = workspace.tabs.filter(key => key !== id);
  return { ...workspace, tabs, activeId: workspace.activeId === id ? tabs[Math.max(0, index - 1)] || "" : workspace.activeId,
    splitId: workspace.splitId === id ? "" : workspace.splitId };
}
export function dailyTitle(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export const noteTemplates = [
  { id: "blank", name: "空白笔记", headings: [], type: "" },
  { id: "paper", name: "论文笔记", headings: ["研究问题", "核心方法", "关键公式", "实验结果", "局限与思考", "关联论文"], type: "论文" },
  { id: "experiment", name: "实验记录", headings: ["实验目标", "环境与参数", "实验结果", "结论", "下一步"], type: "实验" },
  { id: "concept", name: "概念笔记", headings: ["定义", "直觉解释", "示例", "相关概念"], type: "概念" },
  { id: "project", name: "项目记录", headings: ["项目目标", "设计决策", "待办事项", "问题与进展"], type: "项目" },
  { id: "daily", name: "每日笔记", headings: ["今日记录", "学习与发现", "待办", "整理到主题笔记"], type: "日记" }
];
export function templateContent(id, date = dailyTitle()) {
  const template = noteTemplates.find(item => item.id === id) || noteTemplates[0];
  return { html: (id === "daily" ? `<p>${date}</p>` : "") + (template.headings.map(title => `<h2>${title}</h2><p></p>`).join("") || "<p></p>"),
    properties: normalizeProperties({ type: template.type, status: "待整理" }) };
}

export function validateBackup(value) {
  if (value?.version !== 1 || !Array.isArray(value.notes) || !Array.isArray(value.folders)) throw new Error("不是有效的笔记备份文件");
  for (const list of [value.notes, value.folders]) {
    const ids = new Set();
    for (const item of list) {
      if (!item || typeof item.id !== "string" || !item.id || ids.has(item.id)) throw new Error("备份包含无效或重复 ID");
      ids.add(item.id);
    }
  }
  const folders = value.folders.map(f => ({ id: f.id, name: String(f.name || "未命名文件夹"), parentId: f.parentId || null }));
  for (const folder of folders) {
    const seen = new Set([folder.id]); let id = folder.parentId;
    while (id) {
      if (seen.has(id)) throw new Error("备份目录包含循环引用");
      seen.add(id); const parent = folders.find(f => f.id === id);
      if (!parent) throw new Error("备份缺少父目录");
      id = parent.parentId;
    }
  }
  const notes = value.notes.map(note => {
    if (typeof note.title !== "string" || typeof note.html !== "string") throw new Error("备份文档格式不完整");
    if (note.folderId && !folders.some(folder => folder.id === note.folderId)) throw new Error("备份文档缺少目录");
    if (!Array.isArray(note.assets || []) || !Array.isArray(note.tags || [])) throw new Error("备份附件或标签格式无效");
    return { id: note.id, title: note.title, html: note.html, folderId: note.folderId || null,
      tags: (note.tags || []).filter(tag => typeof tag === "string"), properties: normalizeProperties(note.properties),
      date: note.date, dailyDate: typeof note.dailyDate === "string" ? note.dailyDate : "", assets: note.assets || [] };
  });
  return { version: 1, notes, folders };
}

export function mergeBackup(state, backup) {
  const notes = new Map(state.notes.map(note => [note.id, note]));
  const folders = new Map(state.folders.map(folder => [folder.id, folder]));
  backup.notes.forEach(note => notes.set(note.id, { ...notes.get(note.id), ...note, dirty: true, date: new Date().toISOString() }));
  backup.folders.forEach(folder => folders.set(folder.id, folder));
  // A merge can introduce a cycle even when each independent tree is valid.
  const result = { ...state, notes: [...notes.values()], folders: [...folders.values()] };
  validateBackup({ version: 1, notes: result.notes, folders: result.folders });
  return result;
}
