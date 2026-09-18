import React, { useEffect, useMemo, useRef, useState } from "https://esm.sh/react@18.3.1";
import katex from "https://esm.sh/katex@0.16.22";
import { cloudClient } from "./cloud-client.mjs?v=20260917-account-v1";

const h = React.createElement;
const button = (label, onClick, extra = {}) => h("button", { type: "button", onClick, ...extra }, label);

function useCloud(url) {
  const client = useMemo(() => cloudClient(url), [url]);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [revision, refresh] = useState(0);
  useEffect(() => {
    const changed = (event) => { if (event.detail.base === client.base) refresh((v) => v + 1); };
    window.addEventListener("notebook-cloud-session", changed);
    return () => window.removeEventListener("notebook-cloud-session", changed);
  }, [client]);
  useEffect(() => {
    let alive = true; setStatus(null); setError("");
    if (client.base && client.token()) client.request("/api/status").then((s) => { if (alive) setStatus(s); }).catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [client, revision]);
  return { client, status, error, refresh: () => refresh((v) => v + 1) };
}

function Connection({ cloud, onSettings }) {
  const [error, setError] = useState("");
  const perform = async (task) => { try { setError(""); await task(); } catch (e) { setError(e.message); } };
  return h("div", { className: "cloud-connection" },
    h("span", { className: cloud.status?.generation ? "cloud-ready" : "" }, cloud.status?.generation ? `已同步 · ${cloud.status.wikiCount} 个 Wiki 条目` : cloud.client.base ? "云端知识库" : "尚未连接云端知识库"),
    cloud.status ? button("退出登录", () => perform(async () => { await cloud.client.logout(); cloud.refresh(); })) : cloud.client.base ? button("账号登录", () => window.dispatchEvent(new Event("notebook-cloud-login"))) : null,
    button("连接设置", onSettings),
    cloud.client.token() && !cloud.status ? button("重试连接", cloud.refresh) : null,
    (cloud.error || error) ? h("p", { role: "alert" }, cloud.error || error) : null,
    cloud.status?.latest?.error ? h("p", { role: "status" }, cloud.status.latest.error) : null,
    cloud.status && !cloud.status.generation ? h("p", null, "已连接。请在 GitHub Actions 运行首次知识同步。") : null
  );
}

function Sources({ sources = [], onOpen }) {
  return sources.length ? h("details", { className: "cloud-sources" }, h("summary", null, `${sources.length} 处原文证据`),
    sources.map((source, i) => h("div", { key: i }, button(`[${i + 1}] ${source.title} · ${source.heading || "正文"}`, () => onOpen(source)),
      h("p", null, source.text)))) : null;
}

// All model prose is rendered as React text. Only KaTeX's trusted-off renderer emits HTML.
export function KnowledgeMarkdown({ text = "", sources = [], onSource = () => {}, onWiki = () => {} }) {
  const inline = (text) => String(text).split(/(\[\[[^\]]+\]\]|\[\d+\]|\*\*[^*]+\*\*|`[^`]+`|\$[^$\n]+\$)/g).map((part, i) => {
    if (/^\[\[/.test(part)) { const [slug, title] = part.slice(2, -2).split("|"); return button(title || slug, () => onWiki(slug), { key: i, className: "cloud-wikilink" }); }
    if (/^\[\d+\]$/.test(part)) { const s = sources[Number(part.slice(1, -1)) - 1]; return s ? button(part, () => onSource(s), { key: i, className: "cloud-citation", title: s.title }) : part; }
    if (part.startsWith("**")) return h("strong", { key: i }, inline(part.slice(2, -2)));
    if (part.startsWith("`")) return h("code", { key: i }, part.slice(1, -1));
    if (part.startsWith("$") && part.endsWith("$")) return h("span", { key: i, dangerouslySetInnerHTML: { __html: katex.renderToString(part.slice(1, -1), { throwOnError: false, trust: false, maxExpand: 500 }) } });
    return part;
  });
  const lines = text.split("\n"); const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("```")) {
      const code = []; while (++i < lines.length && !lines[i].trim().startsWith("```")) code.push(lines[i]);
      blocks.push(h("pre", { key: i }, h("code", null, code.join("\n"))));
    } else if (line.trim().startsWith("$$")) {
      const math = [line.trim().slice(2)];
      if (!math[0].endsWith("$$")) while (++i < lines.length) { math.push(lines[i]); if (lines[i].trim().endsWith("$$")) break; }
      blocks.push(h("div", { key: i, className: "cloud-math", dangerouslySetInnerHTML: { __html: katex.renderToString(math.join("\n").replace(/\$\$\s*$/, ""), { displayMode: true, throwOnError: false, trust: false, maxExpand: 500 }) } }));
    } else if (line.includes("|") && /^\s*\|?\s*:?-{3}/.test(lines[i + 1] || "")) {
      const cells = (v) => v.trim().replace(/^\||\|$/g, "").split("|"); const header = cells(line); const rows = []; i++;
      while (i + 1 < lines.length && lines[i + 1].includes("|")) rows.push(cells(lines[++i]));
      blocks.push(h("div", { key: i, className: "cloud-table" }, h("table", null,
        h("thead", null, h("tr", null, header.map((c, k) => h("th", { key: k }, inline(c))))),
        h("tbody", null, rows.map((r, j) => h("tr", { key: j }, r.map((c, k) => h("td", { key: k }, inline(c)))))))));
    } else if (/^#{1,4}\s/.test(line)) blocks.push(h(`h${Math.min(4, line.match(/^#+/)[0].length + 1)}`, { key: i }, inline(line.replace(/^#+\s/, ""))));
    else if (/^\s*[-*]\s/.test(line)) blocks.push(h("p", { key: i, className: "cloud-list-line" }, "• ", inline(line.replace(/^\s*[-*]\s/, ""))));
    else if (line.trim()) blocks.push(h("p", { key: i }, inline(line)));
  }
  return h("div", { className: "cloud-markdown" }, blocks);
}

export function CloudAssistant({ notes = [], folders = [], noteId, assistantSettings, onOpenNote, onOpenAssistantSettings }) {
  const cloud = useCloud(assistantSettings.backendUrl);
  const [messages, setMessages] = useState([]); const [question, setQuestion] = useState("");
  const [scope, setScope] = useState(noteId ? `note:${noteId}` : "all"); const [mode, setMode] = useState("normal");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [stage, setStage] = useState("");
  const [conversations, setConversations] = useState([]); const [conversationId, setConversationId] = useState("");
  const controller = useRef(null); const bottom = useRef(null);
  const refreshHistory = () => cloud.client.request("/api/conversations").then(setConversations).catch(() => {});
  useEffect(() => { if (cloud.status) refreshHistory(); else { setConversations([]); setMessages([]); setConversationId(""); } }, [cloud.status]);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { setScope(noteId ? `note:${noteId}` : "all"); }, [noteId]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "nearest" }); }, [messages.length, stage]);
  const openSource = (source) => onOpenNote(source.noteId, source.headingIndex);
  const submit = async (event) => {
    event.preventDefault(); if (busy || !question.trim()) return;
    const text = question.trim(); const id = crypto.randomUUID(); controller.current = new AbortController();
    setQuestion(""); setBusy(true); setError(""); setStage("正在检索原文…");
    setMessages((m) => [...m, { role: "user", content: text }, { id, role: "assistant", content: "", sources: [] }]);
    const update = (patch) => setMessages((m) => m.map((item) => item.id === id ? { ...item, ...patch } : item));
    try {
      const colon = scope.indexOf(":"); const type = scope.slice(0, colon); const value = scope.slice(colon + 1);
      const selected = scope === "all" ? {} : { [type === "note" ? "noteId" : type === "folder" ? "folderId" : "tag"]: value };
      const result = await cloud.client.request("/api/prepare", { data: { question: text, conversationId, scope: selected, mode }, signal: controller.current.signal });
      setConversationId(result.conversationId); update({ sources: result.sources, warnings: result.warnings, content: result.answer || "" });
      if (result.ticket) {
        setStage("正在组织回答…"); let content = "";
        await cloud.client.answer(result.ticket, (delta) => { content += delta; update({ content }); }, controller.current.signal);
      }
      refreshHistory();
    } catch (e) { const message = controller.current.signal.aborted ? "已停止，未完成的回答不计入云端历史。" : e.message; setError(message); update({ interrupted: true }); }
    finally { setBusy(false); setStage(""); }
  };
  const loadConversation = async (id) => {
    try { setError(""); const result = await cloud.client.request(`/api/conversations/${encodeURIComponent(id)}`); setMessages(result.messages); setConversationId(id); }
    catch (e) { setError(e.message); }
  };
  const tags = [...new Set(notes.flatMap((n) => n.tags || []))].sort();
  return h("section", { className: "cloud-assistant" }, h(Connection, { cloud, onSettings: onOpenAssistantSettings }),
    h("p", { className: "cloud-hint" }, "基于已发布笔记回答。尚未发布的本地修改会在下次发布并同步后加入知识库。"),
    h("div", { className: "cloud-toolbar" },
      h("select", { "aria-label": "检索范围", value: scope, disabled: busy, onChange: (e) => setScope(e.target.value) },
        h("option", { value: "all" }, "全部笔记"), noteId ? h("option", { value: `note:${noteId}` }, "当前笔记") : null,
        h("optgroup", { label: "文件夹" }, folders.map((f) => h("option", { key: f.id, value: `folder:${f.id}` }, f.name || f.title))),
        h("optgroup", { label: "标签" }, tags.map((t) => h("option", { key: t, value: `tag:${t}` }, t)))),
      h("select", { "aria-label": "回答模式", value: mode, disabled: busy, onChange: (e) => setMode(e.target.value) }, h("option", { value: "normal" }, "标准问答"), h("option", { value: "deep" }, "深入比较")),
      button("新对话", () => { setMessages([]); setConversationId(""); setError(""); }, { disabled: busy }),
      conversations.length ? h("select", { "aria-label": "历史对话", value: conversationId, disabled: busy, onChange: (e) => { if (e.target.value) loadConversation(e.target.value); } }, h("option", { value: "" }, "历史对话"), conversations.map((c) => h("option", { key: c.id, value: c.id }, c.title))) : null,
      conversationId && !busy ? button("删除对话", async () => { try { await cloud.client.request(`/api/conversations/${conversationId}`, { method: "DELETE" }); setConversationId(""); setMessages([]); refreshHistory(); } catch (e) { setError(e.message); } }) : null),
    h("div", { className: "cloud-messages", role: "log", "aria-label": "问答记录" },
      !messages.length ? h("div", { className: "cloud-empty" }, h("h3", null, "从问题出发，连接你的知识"), h("p", null, "可以追问机制、比较方法，或寻找跨笔记的共同点。每个引用都能回到原文。"),
        button("比较我的笔记中不同的特征融合方法", () => setQuestion("比较我的笔记中不同的特征融合方法"))) : null,
      messages.map((m, i) => h("article", { key: m.id || i, className: `cloud-message ${m.role}` }, h("small", null, m.role === "user" ? "你" : "知识助手"),
        h(KnowledgeMarkdown, { text: m.content, sources: m.sources, onSource: openSource }),
        m.warnings?.map((w) => h("p", { key: w, className: "cloud-hint" }, w)), m.interrupted ? h("p", { className: "cloud-hint" }, "回答未完成") : null,
        h(Sources, { sources: m.sources, onOpen: openSource }))),
      h("div", { ref: bottom }), stage ? h("p", { role: "status" }, stage) : null),
    error ? h("p", { role: "alert", className: "cloud-error" }, error) : null,
    h("form", { onSubmit: submit, className: "cloud-composer" }, h("textarea", { value: question, maxLength: 2000, rows: 3, "aria-label": "向知识库提问", placeholder: "向你的笔记提问…", disabled: busy, onChange: (e) => setQuestion(e.target.value), onKeyDown: (e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(e); } } }),
      busy ? button("停止回答", () => controller.current?.abort()) : h("button", { type: "submit", disabled: !question.trim() || !cloud.status?.generation }, "发送问题")));
}

function Graph({ data, selected, onSelect }) {
  const [zoom, setZoom] = useState(1);
  const positions = useMemo(() => {
    const around = data.nodes.filter((n) => n.slug !== selected);
    return new Map(data.nodes.map((n) => {
      const i = around.indexOf(n); const angle = i * Math.PI * 2 / Math.max(1, around.length);
      const radius = n.slug === selected || data.nodes.length === 1 ? 0 : 220 + (i % 2) * 65;
      return [n.slug, { x: 400 + Math.cos(angle) * radius, y: 340 + Math.sin(angle) * radius }];
    }));
  }, [data, selected]);
  return h("div", { className: "cloud-graph" }, h("div", { className: "cloud-toolbar" }, h("span", null, `${data.nodes.length} / ${data.total} 个条目 · 连线表示 Wiki 引用`), button("缩小", () => setZoom((z) => Math.max(.6, z - .2))), button("放大", () => setZoom((z) => Math.min(2, z + .2)))),
    h("div", { className: "cloud-graph-scroll" }, h("svg", { viewBox: "0 0 800 680", style: { width: `${zoom * 100}%`, height: 440 * zoom, minWidth: 500 * zoom }, role: "group", "aria-label": "Wiki 知识图谱" },
      data.edges.map((e, i) => { const a = positions.get(e.source), b = positions.get(e.target); return h("line", { key: i, x1: a.x, y1: a.y, x2: b.x, y2: b.y, className: "cloud-edge" }); }),
      data.nodes.map((n) => { const p = positions.get(n.slug); return h("g", { key: n.slug, transform: `translate(${p.x} ${p.y})`, role: "button", tabIndex: 0, "aria-label": n.title, className: n.slug === selected ? "is-active" : "", onClick: () => onSelect(n.slug), onKeyDown: (e) => { if (["Enter", " "].includes(e.key)) { e.preventDefault(); onSelect(n.slug); } } }, h("title", null, n.title), h("circle", { r: n.slug === selected ? 12 : 8, className: n.type }), h("text", { y: 26, textAnchor: "middle" }, n.title.length > 19 ? n.title.slice(0, 18) + "…" : n.title)); }))));
}

export function CloudWiki({ assistantSettings, onOpenNote, onOpenAssistantSettings }) {
  const cloud = useCloud(assistantSettings.backendUrl);
  const [pages, setPages] = useState([]); const [query, setQuery] = useState(""); const [selected, setSelected] = useState("");
  const [page, setPage] = useState(null); const [error, setError] = useState(""); const [view, setView] = useState("pages");
  const [graph, setGraph] = useState({ nodes: [], edges: [], total: 0 }); const [depth, setDepth] = useState(1);
  const [draft, setDraft] = useState(null); const [adopt, setAdopt] = useState(false); const [revisions, setRevisions] = useState(null); const [saving, setSaving] = useState(false);
  useEffect(() => { let alive = true; if (cloud.status?.generation) cloud.client.request("/api/wiki").then((p) => { if (alive) setPages(p); }).catch((e) => { if (alive) setError(e.message); }); else { setPages([]); setPage(null); setGraph({ nodes: [], edges: [], total: 0 }); } return () => { alive = false; }; }, [cloud.status]);
  useEffect(() => {
    let alive = true; setPage(null); setDraft(null); setRevisions(null); setError("");
    if (selected && cloud.status?.generation) cloud.client.request(`/api/wiki/page?slug=${encodeURIComponent(selected)}`).then((p) => { if (alive) setPage(p); }).catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [selected, cloud.status]);
  useEffect(() => {
    let alive = true;
    if (view === "graph" && cloud.status?.generation) cloud.client.request(`/api/graph?center=${encodeURIComponent(selected)}&depth=${depth}`).then((g) => { if (alive) setGraph(g); }).catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [view, selected, depth, cloud.status]);
  const openSource = (s) => onOpenNote(s.noteId, s.headingIndex);
  const save = async (extra = {}) => {
    setSaving(true); setError("");
    try { const result = await cloud.client.request(`/api/wiki/page?slug=${encodeURIComponent(selected)}`, { method: "PUT", data: { content: draft, version: page.version, generation: page.generation, useGeneratedEvidence: adopt, ...extra } }); setPage(result); setDraft(null); setRevisions(null); }
    catch (e) { setError(e.message); } finally { setSaving(false); }
  };
  const filtered = pages.filter((p) => p.title.toLowerCase().includes(query.toLowerCase()));
  return h("section", { className: "cloud-wiki" }, h("header", null, h("h1", null, "知识 Wiki"), h("p", null, "将分散的笔记整理为可追溯、可连接的知识条目。")),
    h(Connection, { cloud, onSettings: onOpenAssistantSettings }),
    h("div", { className: "cloud-toolbar" }, button("条目", () => setView("pages"), { "aria-pressed": view === "pages" }), button("知识图谱", () => setView("graph"), { "aria-pressed": view === "graph" }),
      cloud.status ? button("导出 Wiki 备份", async () => {
        try {
          const data = await cloud.client.request("/api/export"); const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
          const a = document.createElement("a"); a.href = url; a.download = `wiki-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (e) { setError(e.message); }
      }) : null,
      view === "graph" ? h(React.Fragment, null, button("全局概览", () => setSelected("")), h("select", { value: depth, "aria-label": "图谱扩展范围", onChange: (e) => setDepth(Number(e.target.value)) }, h("option", { value: 1 }, "一层关联"), h("option", { value: 2 }, "两层关联"))) : null),
    error ? h("p", { role: "alert", className: "cloud-error" }, error) : null,
    h("div", { className: "cloud-wiki-layout" },
      h("aside", { className: "cloud-wiki-list", "aria-label": "Wiki 条目" }, h("input", { type: "search", placeholder: "搜索条目", "aria-label": "搜索 Wiki 条目", value: query, onChange: (e) => setQuery(e.target.value) }),
        filtered.map((p) => button(p.title, () => setSelected(p.slug), { key: p.slug, "aria-current": p.slug === selected ? "page" : undefined, disabled: saving })),
        !filtered.length ? h("p", { className: "cloud-hint" }, pages.length ? "没有匹配的条目" : "首次同步后，条目会出现在这里。") : null),
      h("main", { className: "cloud-wiki-main" }, view === "graph" ? h(Graph, { data: graph, selected, onSelect: setSelected }) : null,
        page ? h("article", { className: "cloud-wiki-page" }, h("h2", null, page.title),
          page.stale ? h("p", { className: "cloud-notice" }, "原笔记已有更新。当前展示保留的人工版本和旧证据；请对比新版后决定是否采用。") : null,
          h("div", { className: "cloud-toolbar" }, button("编辑条目", () => { setDraft(page.content); setAdopt(false); }, { disabled: saving || draft !== null }),
            button("历史版本", async () => { try { setRevisions(await cloud.client.request(`/api/wiki/revisions?slug=${encodeURIComponent(selected)}`)); } catch (e) { setError(e.message); } }),
            button("下载 Markdown", () => { const url = URL.createObjectURL(new Blob([page.content], { type: "text/markdown;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = `${page.slug}.md`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); })),
          draft !== null ? h("div", null, h("textarea", { className: "cloud-wiki-editor", value: draft, maxLength: 20000, disabled: saving, "aria-label": "Wiki Markdown 内容", onChange: (e) => setDraft(e.target.value) }), button(saving ? "保存中…" : "保存新版本", () => save(), { disabled: saving }), button("取消", () => setDraft(null), { disabled: saving })) : h(KnowledgeMarkdown, { text: page.content, sources: page.refs, onSource: openSource, onWiki: setSelected }),
          h(Sources, { sources: page.refs, onOpen: openSource }),
          page.content !== page.generatedContent ? h("details", { className: "cloud-comparison" }, h("summary", null, "对比当前版本与最新自动整理"), h("div", { className: "cloud-compare-grid" }, h("section", null, h("h3", null, "当前版本"), h(KnowledgeMarkdown, { text: page.content, sources: page.refs, onSource: openSource, onWiki: setSelected })), h("section", null, h("h3", null, "最新整理"), h(KnowledgeMarkdown, { text: page.generatedContent, sources: page.generatedRefs, onSource: openSource, onWiki: setSelected }))), button("以最新整理为底稿编辑", () => { setDraft(page.generatedContent); setAdopt(true); }, { disabled: saving })) : null,
          revisions ? h("section", { className: "cloud-revisions" }, h("h3", null, "历史版本"), !revisions.length ? h("p", null, "保存首次编辑后生成版本记录。") : revisions.map((r) => h("details", { key: r.version }, h("summary", null, `版本 ${r.version} · ${r.created_at.slice(0, 16).replace("T", " ")}`), h("pre", null, r.content), button("恢复为新版本", () => save({ revertVersion: r.version }), { disabled: saving })))) : null)
          : view !== "graph" ? h("div", { className: "cloud-empty" }, h("h2", null, selected ? "正在读取条目…" : "选择一个条目，探索知识之间的联系"), h("p", null, "Wiki 依据已发布笔记自动整理，事实引用可回到原文。")) : null)));
}
