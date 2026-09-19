import React, { useEffect, useMemo, useRef, useState } from "https://esm.sh/react@18.3.1";
import { BookOpenText, ChevronDown, Search, NotebookTabs, Star, Tag, Settings, Plus, FileText, X, PanelLeftClose, PanelRightClose, Columns2, Link, Sparkles, CalendarDays, History, Download, Archive, Network } from "https://esm.sh/lucide-react@0.468.0?external=react";
import { buildRelations, referenceExcerpt, textFromNote, searchNotes, normalizeProperties, noteTemplates } from "./knowledge-model.mjs";
import { cloudClient } from "./cloud-client.mjs?v=20260917-account-v1";

const h = React.createElement;
const glyph = (Icon, size = 18) => h(Icon, { size, strokeWidth: 1.7, "aria-hidden": "true" });
const button = (label, onClick, props = {}) => h("button", { type: "button", onClick, ...props }, label);

export function WorkspaceSidebar({ state, tree, settings, open, onNavigate, onSearch, onNew, onTools, onDaily, onOpenNote, onClose, onResize }) {
  const nav = [["library", "笔记", NotebookTabs], ["favorites", "收藏", Star], ["wiki", "知识 Wiki", BookOpenText], ["tags", "标签", Tag]];
  const recent = (state.workspace?.recent || []).map(id => state.notes.find(note => note.id === id)).filter(Boolean).slice(0, 5);
  return h("aside", { id: "context-sidebar", className: `workspace-sidebar ${open ? "is-open" : ""}`, "aria-label": "知识库导航" },
    button([glyph(BookOpenText, 22), h("strong", { key: "title" }, "我的知识库"), glyph(ChevronDown, 15)], () => onNavigate("home"), { className: "workspace-brand", title: "知识库概览" }),
    button([glyph(Search), h("span", { key: "label" }, "搜索笔记…"), h("kbd", { key: "key" }, "Ctrl K")], onSearch, { className: "workspace-search", "aria-label": "搜索笔记、内容或命令" }),
    h("nav", { className: "workspace-navigation", "aria-label": "主导航" }, nav.map(([view, label, Icon]) => button([glyph(Icon, 20), label], () => onNavigate(view), { key: view, className: state.view === view ? "is-active" : "", "aria-current": state.view === view ? "page" : undefined }))),
    h("div", { className: "workspace-sidebar-body" },
      state.view === "settings" ? settings : h(React.Fragment, null,
        h("div", { className: "workspace-folder-heading" }, h("span", null, "文件夹"), button(glyph(Plus), onNew, { "aria-label": "新建笔记或文件夹" })),
        tree,
        recent.length ? h("details", { className: "workspace-recent" }, h("summary", null, "最近打开"), recent.map(note => button([glyph(FileText, 15), note.title], () => onOpenNote(note.id), { key: note.id, title: note.title }))) : null)),
    h("footer", { className: "workspace-sidebar-footer" },
      button([glyph(CalendarDays), "每日笔记"], onDaily),
      button([glyph(Settings, 20), "设置"], () => onNavigate("settings"), { className: state.view === "settings" ? "is-active" : "" }),
      button(glyph(Archive), () => onTools("backup"), { className: "workspace-backup", "aria-label": "备份与导出", title: "备份与导出" })),
    button(glyph(PanelLeftClose), onClose, { className: "workspace-mobile-close", "aria-label": "关闭目录" }),
    h("div", { className: "directory-resize-handle sidebar-resize-handle", title: "拖拽调整目录宽度", onPointerDown: onResize }));
}

export function NoteTabs({ notes, workspace, activeId, onSelect, onClose, onNew, onSplit, splitId, onPanel, panelOpen }) {
  const tabs = (workspace?.tabs || []).map(id => notes.find(note => note.id === id)).filter(Boolean);
  return h("div", { className: "workspace-tabbar" },
    h("div", { className: "workspace-tabs", role: "tablist", "aria-label": "打开的笔记" }, tabs.map(note => h("div", { className: `workspace-tab ${note.id === activeId ? "is-active" : ""}`, key: note.id },
      button([glyph(FileText, 17), h("span", { key: "title" }, note.title)], () => onSelect(note.id), { role: "tab", "aria-selected": note.id === activeId, title: note.title }),
      button(glyph(X, 13), () => onClose(note.id), { className: "workspace-tab-close", "aria-label": `关闭标签页：${note.title}` })))),
    button(glyph(Plus), onNew, { "aria-label": "新建笔记", title: "新建笔记" }),
    button(glyph(Columns2), onSplit, { className: "workspace-split-toggle", "aria-label": splitId ? "退出分屏" : "对照阅读", "aria-pressed": Boolean(splitId), title: splitId ? "退出分屏" : "选择参考笔记" }),
    button(glyph(PanelRightClose), onPanel, { "aria-label": panelOpen ? "收起辅助栏" : "打开辅助栏", "aria-expanded": panelOpen, title: "大纲、关联与 AI 问答" }));
}

export function HighlightText({ text, words = [] }) {
  const value = String(text || ""); const hits = words.filter(Boolean).map(word => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!hits.length) return value;
  const regex = new RegExp(`(${hits.join("|")})`, "gi");
  return value.split(regex).map((part, index) => index % 2 ? h("mark", { key: index }, part) : part);
}

export function KnowledgeDialog({ title, onClose, children, className = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    (ref.current?.querySelector("input:not(:disabled), textarea:not(:disabled)") || ref.current?.querySelector("button"))?.focus();
    return () => { previous?.isConnected && previous.focus(); };
  }, []);
  return h("div", { className: "knowledge-dialog-backdrop", onMouseDown: event => { if (event.target === event.currentTarget) onClose(); } },
    h("section", { ref, role: "dialog", "aria-modal": "true", "aria-label": title, className: `knowledge-dialog ${className}`, onKeyDown: event => {
      if (event.key === "Escape") { event.stopPropagation(); onClose(); }
      if (event.key === "Tab") {
        const elements = [...ref.current.querySelectorAll("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]")].filter(el => el.getClientRects().length);
        const first = elements[0]; const last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    } }, h("header", null, h("h2", null, title), button(glyph(X), onClose, { "aria-label": "关闭" })), children));
}

export function QuickOpen({ notes, folders, recent = [], query, onQuery, onOpen, onClose, commands = [], title = "搜索笔记与命令" }) {
  const results = useMemo(() => query.trim() ? searchNotes(notes, query, folders) : recent.map(id => notes.find(n => n.id === id)).filter(Boolean).map(note => ({ note, excerpt: textFromNote(note.html).slice(0, 120), words: [] })), [notes, folders, recent, query]);
  const items = results.length || query ? results.slice(0, 40) : searchNotes(notes, "", folders).slice(0, 10);
  const [index, setIndex] = useState(0);
  const matchedCommands = commands.filter(item => item.label.includes(query.trim().replace(/^>/, "")));
  const actions = [...items.map(result => () => onOpen(result.note.id)), ...matchedCommands.map(command => command.run)];
  useEffect(() => setIndex(0), [query]);
  useEffect(() => { document.querySelector(".quick-results .is-active")?.scrollIntoView({ block: "nearest" }); }, [index]);
  return h(KnowledgeDialog, { title, onClose, className: "quick-open" },
    h("input", { className: "quick-input", autoFocus: true, "aria-label": "搜索笔记与命令", placeholder: "笔记标题、正文，或 tag:标签 path:目录", value: query, onChange: event => onQuery(event.target.value), onKeyDown: event => {
      if (event.nativeEvent.isComposing) return;
      if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); setIndex(i => (i + (event.key === "ArrowDown" ? 1 : -1) + actions.length) % Math.max(1, actions.length)); }
      if (event.key === "Enter") { event.preventDefault(); actions[index]?.(); }
    } }),
    h("div", { className: "quick-results" }, h("small", null, query ? `${results.length} 篇匹配笔记` : "最近打开"),
      items.map((result, i) => button(h(React.Fragment, null, h("strong", null, glyph(FileText, 16), h(HighlightText, { text: result.note.title, words: result.words })), h("small", null, result.path), h("p", null, h(HighlightText, { text: result.excerpt, words: result.words }))), () => onOpen(result.note.id), { key: result.note.id, className: i === index ? "is-active" : "" })),
      !items.length ? h("p", { className: "knowledge-empty" }, "没有找到笔记，试试其他关键词。") : null,
      matchedCommands.length ? h("small", null, "操作") : null,
      matchedCommands.map((command, i) => button(command.label, command.run, { key: command.id, className: i + items.length === index ? "is-active" : "" }))),
    h("footer", null, "↑ ↓ 选择 · Enter 打开 · Esc 关闭"));
}

export function RelationsPane({ notes, noteId, onOpenNote, onLink, canEdit, backendUrl, onAssistant }) {
  const relations = useMemo(() => buildRelations(notes, noteId), [notes, noteId]);
  const [graph, setGraph] = useState(false); const [suggestions, setSuggestions] = useState([]); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const requestRef = useRef(null);
  useEffect(() => { setSuggestions([]); setError(""); setBusy(false); return () => requestRef.current?.abort(); }, [noteId]);
  const suggest = async () => {
    const controller = new AbortController(); requestRef.current = controller;
    setBusy(true); setError("");
    try {
      const note = notes.find(n => n.id === noteId);
      if (!note?.publishedAt) throw new Error("请先发布当前笔记，再获取 AI 关联建议。");
      const client = cloudClient(backendUrl);
      if (!client.base) throw new Error("请先在设置中配置 AI 服务。");
      // Only the published identity is used; local draft text is never transmitted.
      const result = await client.request("/api/prepare", { data: { question: "推荐关联笔记", relatedNoteId: noteId, scope: {}, mode: "normal" }, signal: controller.signal });
      let answer = result.answer || "";
      if (result.ticket) await client.answer(result.ticket, delta => { answer += delta; }, controller.signal);
      if (controller.signal.aborted) return;
      const ids = [...new Set((result.sources || []).map(source => source.noteId))];
      setSuggestions(ids.filter(id => id !== noteId && notes.some(n => n.id === id)).map(id => ({ note: notes.find(n => n.id === id), reason: answer })));
      if (!ids.some(id => id !== noteId)) setError("本次没有找到其他可引用的笔记。可以在 AI 问答中进一步提问。");
    } catch (e) { if (!controller.signal.aborted) setError(e.message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  const section = (label, items, incoming = false) => h("section", { className: "relation-section" }, h("h3", null, label, h("span", null, items.length)), items.length ? items.map(note => button(h(React.Fragment, null,
    h("strong", null, glyph(incoming ? FileText : Link, 17), note.title), incoming ? h("p", null, referenceExcerpt(note, noteId)) : null), () => onOpenNote(note.id), { key: note.id, className: "relation-item" })) : h("p", { className: "knowledge-empty" }, incoming ? "其他笔记引用本页后，会显示在这里。" : "编辑时输入 [[ 连接其他笔记。"));
  return h("div", { className: "relations-pane" }, h("div", { className: "relations-scroll" },
    section("反向链接", relations.incoming, true), section("本页链接", relations.outgoing),
    relations.missing.length ? h("p", { className: "knowledge-warning" }, `${relations.missing.length} 个引用的目标已删除或尚未发布。`) : null,
    h("section", { className: "relation-section" }, button([glyph(Network, 16), graph ? "收起局部图谱" : "查看局部图谱"], () => setGraph(!graph), { className: "relation-disclosure", "aria-expanded": graph }),
      graph ? h("div", { className: "local-graph", "aria-label": "当前笔记一跳关系图" },
        h("small", null, "引用本页"), ...relations.incoming.map(n => button(n.title, () => onOpenNote(n.id), { key: `in-${n.id}` })),
        h("div", { className: "graph-connector", "aria-hidden": "true" }), h("strong", { className: "graph-current" }, notes.find(n => n.id === noteId)?.title),
        h("div", { className: "graph-connector", "aria-hidden": "true" }), h("small", null, "本页引用"), ...relations.outgoing.map(n => button(n.title, () => onOpenNote(n.id), { key: `out-${n.id}` })),
        !relations.incoming.length && !relations.outgoing.length ? h("p", null, "建立一个内部链接，即可连接图谱。") : null) : null),
    h("section", { className: "relation-section" }, button([glyph(Sparkles, 16), busy ? "正在查找关联…" : "AI 关联建议"], suggest, { disabled: busy }),
      h("p", { className: "knowledge-empty" }, "依据已发布笔记检索；确认后才添加引用。"),
      error ? h("p", { role: "alert", className: "knowledge-warning" }, error) : null,
      suggestions.length ? h("details", null, h("summary", null, "查看 AI 建议依据"), h("p", { className: "suggestion-reason" }, suggestions[0].reason)) : null,
      suggestions.map(({ note }) => h("div", { key: note.id, className: "suggestion-row" }, button(note.title, () => onOpenNote(note.id)), button("添加引用", () => onLink(note.id), { disabled: !canEdit || relations.outgoing.some(n => n.id === note.id), title: canEdit ? "添加到当前笔记末尾" : "登录并进入编辑模式后添加" }))))),
    button([glyph(Sparkles), "基于当前文章提问…"], onAssistant, { className: "relation-ask" }));
}

export function NoteProperties({ note, editable, onChange, onHistory, onExport }) {
  const properties = normalizeProperties(note.properties);
  const change = (key, value) => onChange(normalizeProperties({ ...properties, [key]: value }));
  return h("div", { className: "note-tools" },
    h("details", { className: "note-properties" }, h("summary", null, properties.type || "笔记属性", properties.status ? ` · ${properties.status}` : ""),
      h("div", { className: "property-grid" },
        h("label", null, "类型", h("select", { value: properties.type, disabled: !editable, onChange: e => change("type", e.target.value) }, ["", "论文", "实验", "概念", "项目", "日记"].map(type => h("option", { key: type, value: type }, type || "未设置")))),
        h("label", null, "状态", h("select", { value: properties.status, disabled: !editable, onChange: e => change("status", e.target.value) }, ["", "待整理", "在读", "已整理", "已归档"].map(status => h("option", { key: status, value: status }, status || "未设置")))),
        h("label", null, "来源", editable ? h("input", { key: `${note.id}-source-${properties.source}`, defaultValue: properties.source, type: "url", placeholder: "https://…", onBlur: e => { if (e.target.validity.valid) change("source", e.target.value); else e.target.reportValidity(); } }) : properties.source ? h("a", { href: properties.source, target: "_blank", rel: "noreferrer" }, properties.source) : h("span", null, "未设置")),
        h("label", null, "别名", h("input", { key: `${note.id}-aliases-${properties.aliases.join(",")}`, defaultValue: properties.aliases.join("，"), disabled: !editable, placeholder: "用逗号分隔", onBlur: e => change("aliases", e.target.value.split(/[,，]/)) })))),
    button(glyph(History, 16), onHistory, { title: "历史版本", "aria-label": "历史版本" }), button(glyph(Download, 16), onExport, { title: "导出此笔记", "aria-label": "导出此笔记" }));
}

export function CreateNoteDialog({ onClose, onCreate, onFolder }) {
  const [title, setTitle] = useState(""); const [template, setTemplate] = useState("blank");
  return h(KnowledgeDialog, { title: "新建笔记", onClose }, h("form", { onSubmit: e => { e.preventDefault(); onCreate(title.trim() || "未命名文档", template); } },
    h("label", null, "笔记标题", h("input", { autoFocus: true, value: title, onChange: e => setTitle(e.target.value), placeholder: "给想法一个名字" })),
    h("div", { className: "template-options", role: "group", "aria-label": "选择模板" }, noteTemplates.filter(t => t.id !== "daily").map(item => button([h("strong", { key: "name" }, item.name), h("small", { key: "summary" }, item.headings.slice(0, 3).join(" · ") || "自由记录")], () => setTemplate(item.id), { key: item.id, "aria-pressed": template === item.id }))),
    h("footer", null, button("新建文件夹", onFolder), h("button", { type: "submit", className: "primary-btn" }, "创建笔记"))));
}
