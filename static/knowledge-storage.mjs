import React, { useEffect, useState } from "https://esm.sh/react@18.3.1";
import { KnowledgeDialog } from "./knowledge-ui.mjs?v=20260920-sources-v2";
import { dailyTitle, normalizeProperties, linkedNoteId, validateBackup, textFromNote } from "./knowledge-model.mjs?v=20260920-sources-v2";
import { blobToBase64, dataUrlToBlob } from "./draft-asset-store.mjs";
import { zipFiles } from "./notebook-zip.mjs";

const h = React.createElement;
const button = (label, onClick, props = {}) => h("button", { type: "button", onClick, ...props }, label);
let databasePromise;
function historyDatabase() {
  databasePromise ||= new Promise((resolve, reject) => {
    const request = indexedDB.open("personal-notebook-history-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("versions", { keyPath: "noteId" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return databasePromise;
}
async function versionsFor(noteId) {
  const db = await historyDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction("versions").objectStore("versions").get(noteId);
    request.onsuccess = () => resolve(request.result?.items || []);
    request.onerror = () => reject(request.error);
  });
}
const snapshotQueues = new Map();
export function saveSnapshot(note, store, force = false) {
  const task = (snapshotQueues.get(note.id) || Promise.resolve()).catch(() => {}).then(async () => {
    const items = await versionsFor(note.id);
    const fingerprint = JSON.stringify([note.title, note.html, normalizeProperties(note.properties)]);
    if (!force && items[0]?.fingerprint === fingerprint) return;
    const portable = (await portableNotes([note], store, false))[0];
    const next = [{ at: new Date().toISOString(), fingerprint, note: portable }, ...items].slice(0, 20);
    const db = await historyDatabase();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction("versions", "readwrite");
      transaction.objectStore("versions").put({ noteId: note.id, items: next });
      transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error);
    });
  });
  snapshotQueues.set(note.id, task);
  task.finally(() => { if (snapshotQueues.get(note.id) === task) snapshotQueues.delete(note.id); }).catch(() => {});
  return task;
}

async function portableNotes(notes, store, includePublished) {
  const result = [];
  for (const note of notes) {
    let html = note.html || "";
    const template = document.createElement("template"); template.innerHTML = html;
    const assets = structuredClone(note.assets || []);
    // Also capture embedded media not tracked by an asset record (e.g. older imported notes).
    for (const element of template.content.querySelectorAll("img[src],video[src],source[src],a.doc-attachment[href]")) {
      const url = element.getAttribute(element.tagName === "A" ? "href" : "src");
      if (!assets.some(asset => [asset.localUrl, asset.remotePath, asset.dataUrl].includes(url))) assets.push({ id: `embedded-${assets.length}`, localUrl: url, name: url.split("/").pop()?.split("?")[0] || "attachment" });
    }
    const bundled = [];
    for (const asset of assets) {
      const urls = [asset.localUrl, asset.dataUrl, asset.remotePath, asset.assetId && `draft-asset://${asset.assetId}`].filter(Boolean);
      const references = urls.filter(url => html.includes(url));
      if (!references.length) continue;
      let blob;
      // Old cache metadata does not make a published URL a local draft attachment.
      const local = references.find(url => /^(blob:|data:|draft-asset:|\/api\/local-assets\/)/.test(url));
      if (local && asset.storage === "indexeddb" && asset.assetId) blob = await store.get(asset.assetId);
      if (!blob && local?.startsWith("data:")) blob = dataUrlToBlob(local);
      const candidate = local && !local.startsWith("draft-asset:") ? local : includePublished ? references.find(url => !url.startsWith("draft-asset:")) : null;
      if (!blob && candidate) {
        const address = new URL(candidate, location.href);
        if (address.origin === location.origin || address.protocol === "blob:") {
          const response = await fetch(address); if (!response.ok) throw new Error(`附件读取失败：${asset.name || candidate}`);
          blob = await response.blob();
        }
      }
      if (!blob && local) throw new Error(`本地附件不可用：${asset.name || local}`);
      if (blob) {
        const dataUrl = `data:${blob.type || "application/octet-stream"};base64,${await blobToBase64(blob)}`;
        for (const url of urls) html = html.split(url).join(dataUrl);
        bundled.push({ id: asset.id || crypto.randomUUID(), name: asset.name || asset.fileName || "attachment", type: blob.type, size: blob.size, dataUrl });
      } else bundled.push({ id: asset.id, name: asset.name, remotePath: asset.remotePath || asset.localUrl, published: true });
    }
    result.push({ id: note.id, title: note.title, folderId: note.folderId, tags: note.tags || [], date: note.date,
      properties: normalizeProperties(note.properties), dailyDate: note.dailyDate || "", html, assets: bundled });
  }
  return result;
}

export async function restorePortableNotes(notes, store) {
  const result = [];
  for (const source of notes) {
    const note = structuredClone(source);
    note.assets = [];
    for (const asset of source.assets || []) {
      if (!asset.dataUrl) { note.assets.push(asset); continue; }
      const blob = dataUrlToBlob(asset.dataUrl); const assetId = crypto.randomUUID();
      await store.put(assetId, blob); const localUrl = await store.createObjectUrl(assetId);
      const name = (asset.name || "attachment").replace(/[\\/:*?"<>|]/g, "-").slice(0, 120);
      const remotePath = `notebooks/assets/${encodeURIComponent(note.id)}/${assetId}-${name}`;
      note.html = note.html.split(asset.dataUrl).join(localUrl);
      note.assets.push({ ...asset, id: assetId, assetId, storage: "indexeddb", localUrl, remotePath, dataUrl: "", content: "", published: false });
    }
    result.push(note);
  }
  return result;
}

function saveDownload(blob, filename) {
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
const safeFile = name => String(name).replace(/[\\/:*?"<>|]/g, "-").replace(/^\.+/, "").slice(0, 100) || "note";
function markdownFromHtml(html, filenames) {
  const template = document.createElement("template"); template.innerHTML = html;
  const walk = node => {
    if (node.nodeType === 3) return node.textContent.replace(/([\\`*_[\]])/g, "\\$1");
    if (node.nodeType !== 1 && node.nodeType !== 11) return "";
    const inner = () => [...node.childNodes].map(walk).join("");
    const tag = node.nodeName.toLowerCase();
    const type = node.getAttribute?.("data-type");
    if (type === "whiteboard") return `\n\n\`\`\`whiteboard\n${node.getAttribute("data-whiteboard") || "{}"}\n\`\`\`\n\n`;
    if (type === "math-inline") return `$${node.getAttribute("data-tex") || node.textContent}$`;
    if (type === "math-block") return `\n\n$$\n${node.getAttribute("data-tex") || node.textContent}\n$$\n\n`;
    if (type === "mermaid-diagram") return `\n\n\`\`\`mermaid\n${node.getAttribute("data-mermaid-code") || node.textContent}\n\`\`\`\n\n`;
    if (/^h[1-6]$/.test(tag)) return `\n\n${"#".repeat(Number(tag[1]))} ${inner()}\n\n`;
    if (tag === "pre") { const text = node.textContent; const fence = "`".repeat(Math.max(3, ...[...text.matchAll(/`+/g)].map(m => m[0].length + 1))); return `\n\n${fence}${node.querySelector("code")?.className.match(/language-([\w+-]+)/)?.[1] || ""}\n${text}\n${fence}\n\n`; }
    if (tag === "code") return `\`${node.textContent}\``;
    if (tag === "strong" || tag === "b") return `**${inner()}**`;
    if (tag === "em" || tag === "i") return `*${inner()}*`;
    if (tag === "s" || tag === "del") return `~~${inner()}~~`;
    if (tag === "a") { const href = node.getAttribute("href") || ""; const id = linkedNoteId(href); return `[${inner()}](${id && filenames.has(id) ? encodeURI(filenames.get(id)) : href})`; }
    if (tag === "img") return `![${node.getAttribute("alt") || "图片"}](${node.getAttribute("src") || ""})`;
    if (tag === "video") return `\n[视频](${node.getAttribute("src") || node.querySelector("source")?.getAttribute("src") || ""})\n`;
    if (tag === "br") return "\n";
    if (tag === "li") return `\n${type === "taskItem" ? `- [${node.getAttribute("data-checked") === "true" ? "x" : " "}]` : node.parentElement?.tagName === "OL" ? `${[...node.parentElement.children].indexOf(node) + 1}.` : "-"} ${inner().trim()}\n`;
    if (tag === "blockquote") return `\n\n${inner().trim().split("\n").map(line => `> ${line}`).join("\n")}\n\n`;
    if (tag === "table") {
      const rows = [...node.querySelectorAll("tr")].map(row => [...row.children].map(cell => [...cell.childNodes].map(walk).join("").trim().replace(/\n+/g, "<br>").replace(/\|/g, "\\|")).join(" | "));
      if (!rows.length) return "";
      return `\n\n| ${rows[0]} |\n| ${[...node.querySelector("tr").children].map(() => "---").join(" | ")} |\n${rows.slice(1).map(row => `| ${row} |`).join("\n")}\n\n`;
    }
    if (["script", "style", "input"].includes(tag)) return "";
    return ["p", "div", "ul", "ol"].includes(tag) ? `\n\n${inner()}\n\n` : inner();
  };
  return walk(template.content).replace(/\n{3,}/g, "\n\n").trim();
}

export async function downloadNotebook(state, store, format = "backup") {
  const notes = await portableNotes(state.notes, store, true);
  const backup = { version: 1, exportedAt: new Date().toISOString(), notes, folders: state.folders, ...(state.sources !== undefined ? { sources: state.sources } : {}) };
  if (format === "backup") { saveDownload(new Blob([JSON.stringify(backup)], { type: "application/json" }), `notebook-backup-${dailyTitle()}.json`); return; }
  const files = []; const names = new Map(notes.map(note => [note.id, `${safeFile(note.title)}--${safeFile(note.id)}.md`]));
  for (const note of notes) {
    let html = note.html;
    for (const [index, asset] of note.assets.entries()) {
      if (!asset.dataUrl) continue;
      const blob = dataUrlToBlob(asset.dataUrl); const path = `assets/${safeFile(note.id)}/${index}-${safeFile(asset.name)}`;
      files.push({ name: path, data: new Uint8Array(await blob.arrayBuffer()) }); html = html.split(asset.dataUrl).join(encodeURI(path));
    }
    const properties = normalizeProperties(note.properties);
    const metadata = Object.entries({ title: note.title, id: note.id, tags: note.tags, ...properties }).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join("\n");
    files.push({ name: names.get(note.id), data: `---\n${metadata}\n---\n\n# ${note.title}\n\n${markdownFromHtml(html, names)}\n` });
  }
  // Full-fidelity JSON accompanies Markdown so rich content is always recoverable.
  files.push({ name: "notebook-backup.json", data: JSON.stringify(backup) });
  files.push({ name: "README.txt", data: "Markdown 与附件导出。使用 notebook-backup.json 可完整恢复原始富文本、目录和属性。外部网站图片保留原 URL。单篇导出中未包含的引用目标保留笔记 ID 链接。\n" });
  saveDownload(zipFiles(files), `notebook-markdown-${dailyTitle()}.zip`);
}

export function HistoryDialog({ note, canRestore, onRestore, onClose }) {
  const [versions, setVersions] = useState([]); const [selected, setSelected] = useState(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { let alive = true; Promise.resolve(snapshotQueues.get(note.id)).then(() => versionsFor(note.id)).then(items => { if (alive) setVersions(items); }).catch(e => { if (alive) setError(e.message); }); return () => { alive = false; }; }, [note.id]);
  return h(KnowledgeDialog, { title: "历史版本", onClose }, h("p", { className: "knowledge-empty" }, "保留最近 20 个本机快照。恢复前会保存当前内容；恢复结果需另行发布。"),
    h("div", { className: "history-list" }, versions.map((version, index) => button([h("strong", { key: "at" }, new Date(version.at).toLocaleString()), h("span", { key: "title" }, version.note.title)], () => setSelected(version), { key: `${version.at}-${index}`, "aria-pressed": version === selected }))),
    !versions.length ? h("p", null, "还没有历史版本，编辑后会自动创建快照。") : null,
    selected ? h("div", { className: "history-preview" }, h("h3", null, selected.note.title), h("p", null, textFromNote(selected.note.html).slice(0, 1500)), button(busy ? "正在恢复…" : "恢复这个版本", async () => { setBusy(true); try { await onRestore(selected.note); } catch (e) { setError(e.message); } finally { setBusy(false); } }, { disabled: busy || !canRestore, className: "primary-btn" })) : null,
    !canRestore ? h("p", null, "登录后可以恢复版本。") : null, error ? h("p", { role: "alert" }, error) : null);
}

export function BackupDialog({ state, store, canRestore, onRestore, onClose }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [backup, setBackup] = useState(null); const [message, setMessage] = useState("");
  const run = async task => { setBusy(true); setError(""); try { await task(); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  return h(KnowledgeDialog, { title: "备份与导出", onClose }, h("p", null, "备份包含笔记、目录、属性和可读取的本地／已发布附件，不包含账号凭据或 AI 对话。"),
    h("div", { className: "backup-actions" }, button("下载完整备份", () => run(() => downloadNotebook(state, store, "backup")), { disabled: busy }), button("导出 Markdown 与附件", () => run(() => downloadNotebook(state, store, "markdown")), { disabled: busy })),
    h("label", { className: "backup-import" }, "从备份恢复", h("input", { type: "file", accept: ".json,application/json", disabled: busy || !canRestore, onChange: e => { const file = e.target.files?.[0]; if (file) run(async () => { setBackup(null); setMessage(""); setBackup(validateBackup(JSON.parse(await file.text()))); }); } })),
    !canRestore ? h("p", { className: "knowledge-empty" }, "登录后可以恢复备份。") : null,
    backup ? h("div", null, h("p", null, `备份包含 ${backup.notes.length} 篇笔记、${backup.folders.length} 个文件夹${backup.sources !== undefined ? `、${backup.sources.length} 个信息源（将替换本地清单）` : ""}；${backup.notes.filter(note => state.notes.some(n => n.id === note.id)).length} 篇将更新本地内容。备份之外的笔记会保留，原版本会保存快照。`), button("确认合并到本地草稿", () => run(async () => { await onRestore(backup); setBackup(null); setMessage("已恢复，可关闭窗口并审阅本地修改。"); }), { disabled: busy, className: "primary-btn" })) : null,
    busy ? h("p", { role: "status" }, "正在处理笔记与附件…") : null, message ? h("p", { role: "status" }, message) : null, error ? h("p", { role: "alert", className: "knowledge-warning" }, error) : null);
}
