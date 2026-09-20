import React, { useEffect, useRef, useState } from "https://esm.sh/react@18.3.1";
import { Search, Plus, Star, MoreHorizontal, ExternalLink, Globe, Pencil, Trash2, GripVertical, ArrowUp, ArrowDown } from "https://esm.sh/lucide-react@0.468.0?external=react";
import { KnowledgeDialog } from "./knowledge-ui.mjs?v=20260920-sources-v2";
import { SOURCE_CATEGORIES, saveSource, visibleSources, moveSource } from "./sources-model.mjs";
const h = React.createElement;
const icon = Icon => h(Icon, { size: 18, strokeWidth: 1.7, "aria-hidden": true });
const button = (label, onClick, props = {}) => h("button", { type: "button", onClick, ...props }, label);
function SiteIcon({ url }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return h("span", { className: "source-logo" }, failed ? icon(Globe) : h("img", { src: new URL("/favicon.ico", url).href, alt: "", loading: "lazy", referrerPolicy: "no-referrer", onError: () => setFailed(true) }));
}
export function SourcesPage({ sources, canEdit, onChange, onLogin, onOriginal, onPublish, dirty, saving, persistenceStatus }) {
  const [query, setQuery] = useState(""), [category, setCategory] = useState("全部");
  const [form, setForm] = useState(null), [error, setError] = useState(""), [menu, setMenu] = useState(null), [removed, setRemoved] = useState(null), [drag, setDrag] = useState(null);
  const menuRef = useRef(null), undoTimer = useRef(0);
  const dragRef = useRef(null);
  const [dropTarget, setDropTarget] = useState(null);
  const items = visibleSources(sources, query, category);
  useEffect(() => () => clearTimeout(undoTimer.current), []);
  useEffect(() => {
    if (!menu) return;
    const close = event => { if (!menuRef.current?.contains(event.target)) setMenu(null); };
    const escape = event => { if (event.key === "Escape") setMenu(null); };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [menu]);
  useEffect(() => { if (!canEdit) { setForm(null); setMenu(null); setRemoved(null); } }, [canEdit]);
  const edit = item => { if (!canEdit) { onLogin(); return; } setError(""); setForm(item || { id: crypto.randomUUID(), name: "", url: "", description: "", category: "未分类", pinned: false }); setMenu(null); };
  const change = next => { if (canEdit) onChange(next); };
  const endDrag = (event, cancel = false) => {
    const current = dragRef.current;
    dragRef.current = null; setDrag(null); setDropTarget(null);
    if (!current || current.pointerId !== event.pointerId) return;
    if (!cancel && current.moved && current.target) change(moveSource(sources, current.id, current.target));
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const remove = item => {
    const index = sources.findIndex(s => s.id === item.id);
    change(sources.filter(s => s.id !== item.id)); setRemoved({ item, index }); setMenu(null);
    clearTimeout(undoTimer.current); undoTimer.current = setTimeout(() => setRemoved(null), 10000);
  };
  const undo = () => {
    if (!removed) return;
    try { const next = saveSource(sources, removed.item); const item = next.pop(); next.splice(removed.index, 0, item); change(next); setRemoved(null); }
    catch (e) { setRemoved({ ...removed, error: e.message }); }
  };
  return h("section", { className: "sources-page" },
    h("header", { className: "sources-header" }, h("div", null, h("h1", null, "信息源"), h("p", null, "把值得每天打开的网站，收在一起。")),
      h("div", { className: "sources-header-actions" }, button([icon(Plus), "添加网站"], () => edit(), { className: "primary-btn" }),
        onOriginal ? button(["查看原始笔记", icon(ExternalLink)], onOriginal, { className: "source-original" }) : null)),
    h("div", { className: "sources-status" }, h("span", null, `已收集 ${sources.length} 个网站`),
      canEdit ? h("span", { className: "sources-sync" }, persistenceStatus === "error" ? "本地保存失败" : persistenceStatus === "saving" ? "正在保存…" : dirty ? "已保存本地 · 待发布" : "", dirty ? button(saving ? "正在发布…" : "发布同步", onPublish, { disabled: saving }) : null) : null),
    h("div", { className: "sources-filters" }, h("label", { className: "sources-search" }, icon(Search), h("input", { value: query, onChange: e => setQuery(e.target.value), placeholder: "搜索名称、网址或简介…", "aria-label": "搜索信息源" })),
      h("div", { className: "source-categories", "aria-label": "信息源分类" }, ["全部", ...SOURCE_CATEGORIES.filter(c => c !== "未分类" || sources.some(s => s.category === c))].map(c => button(c, () => setCategory(c), { key: c, "aria-pressed": category === c })))),
    h("div", { className: "sources-grid" }, items.map((item, index) => h("article", { key: item.id, className: `source-card${drag === item.id ? " is-dragging" : ""}${dropTarget === item.id ? " is-drop-target" : ""}`, "aria-label": item.name, "data-source-id": item.id },
      h("div", { className: "source-card-top" }, h(SiteIcon, { url: item.url }),
        canEdit ? h("div", { className: "source-card-actions" },
          h("button", { type: "button", className: "source-drag", title: "拖拽排序，也可在管理菜单中移动", "aria-label": `拖拽排序：${item.name}`,
            onPointerDown: e => { if (e.button !== 0) return; e.preventDefault(); dragRef.current = { id: item.id, pointerId: e.pointerId, x: e.clientX, y: e.clientY, moved: false }; e.currentTarget.setPointerCapture(e.pointerId); },
            onPointerMove: e => {
              const current = dragRef.current; if (!current || current.pointerId !== e.pointerId) return;
              if (!current.moved && Math.hypot(e.clientX - current.x, e.clientY - current.y) < 4) return;
              current.moved = true; setDrag(current.id);
              const target = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-source-id]")?.dataset.sourceId;
              current.target = target !== current.id && sources.find(s => s.id === target)?.pinned === item.pinned ? target : null;
              setDropTarget(current.target);
            }, onPointerUp: e => endDrag(e), onPointerCancel: e => endDrag(e, true), onLostPointerCapture: e => endDrag(e, true) }, icon(GripVertical)),
          button(icon(Star), () => change(sources.map(s => s.id === item.id ? { ...s, pinned: !s.pinned } : s)), { "aria-label": `${item.pinned ? "取消置顶" : "置顶"}：${item.name}`, "aria-pressed": item.pinned, className: item.pinned ? "is-pinned" : "" }),
          h("div", { className: "source-menu-anchor", ref: menu === item.id ? menuRef : null }, button(icon(MoreHorizontal), () => setMenu(menu === item.id ? null : item.id), { "aria-label": `管理：${item.name}`, "aria-expanded": menu === item.id }),
            menu === item.id ? h("div", { className: "source-menu" },
              button([icon(Pencil), "编辑网站"], () => edit(item)),
              button([icon(Star), item.pinned ? "取消置顶" : "置顶网站"], () => { change(sources.map(s => s.id === item.id ? { ...s, pinned: !s.pinned } : s)); setMenu(null); }),
              button([icon(ArrowUp), "向前移动"], () => change(moveSource(sources, item.id, items[index - 1]?.id)), { disabled: !items[index - 1] || items[index - 1].pinned !== item.pinned }),
              button([icon(ArrowDown), "向后移动"], () => change(moveSource(sources, item.id, items[index + 1]?.id)), { disabled: !items[index + 1] || items[index + 1].pinned !== item.pinned }),
              button([icon(Trash2), "删除网站"], () => remove(item), { className: "source-delete" })) : null)) : item.pinned ? icon(Star) : null),
      h("h2", null, item.name), h("div", { className: "source-domain" }, new URL(item.url).hostname.replace(/^www\./, "")), h("p", { className: "source-description" }, item.description || "暂无简介"),
      h("span", { className: "source-category" }, item.category), h("a", { className: "source-open", href: item.url, target: "_blank", rel: "noopener noreferrer" }, "打开网站", icon(ExternalLink))))),
    !items.length ? h("div", { className: "sources-empty" }, icon(Globe), h("h2", null, sources.length ? "没有找到匹配的网站" : "收藏你的第一个信息源"), h("p", null, sources.length ? "试试其他关键词或分类。" : "添加常看的日报、周刊或资讯网站。"), button(sources.length ? "清除筛选" : "添加网站", () => sources.length ? (setQuery(""), setCategory("全部")) : edit())) : null,
    removed ? h("div", { className: "source-undo", role: "status" }, removed.error || `已移除「${removed.item.name}」`, button("撤销", undo)) : null,
    form && canEdit ? h(KnowledgeDialog, { title: sources.some(s => s.id === form.id) ? "编辑网站" : "添加网站", onClose: () => setForm(null), className: "source-dialog" },
      h("form", { onSubmit: e => { e.preventDefault(); try { change(saveSource(sources, form)); setForm(null); } catch (e) { setError(e.message); } } },
        h("label", null, "网站名称", h("input", { value: form.name, required: true, maxLength: 100, onChange: e => setForm({ ...form, name: e.target.value }), placeholder: "例如：我的科技周刊" })),
        h("label", null, "网站地址", h("input", { value: form.url, required: true, type: "url", maxLength: 2000, onChange: e => setForm({ ...form, url: e.target.value }), placeholder: "https://…" })),
        h("label", null, "分类", h("select", { value: form.category, onChange: e => setForm({ ...form, category: e.target.value }) }, SOURCE_CATEGORIES.map(c => h("option", { key: c }, c)))),
        h("label", null, "简介（选填）", h("textarea", { value: form.description, maxLength: 300, rows: 3, onChange: e => setForm({ ...form, description: e.target.value }), placeholder: "写一句你推荐它的理由" })),
        h("label", { className: "source-pin-field" }, h("input", { type: "checkbox", checked: form.pinned, onChange: e => setForm({ ...form, pinned: e.target.checked }) }), "置顶到列表前面"),
        error ? h("p", { role: "alert", className: "source-form-error" }, error) : null,
        h("footer", null, button("取消", () => setForm(null)), h("button", { type: "submit", className: "primary-btn" }, "保存网站")))) : null);
}
