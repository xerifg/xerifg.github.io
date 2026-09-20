import React, { useEffect, useLayoutEffect, useRef, useState } from "https://esm.sh/react@18.3.1";
import { createPortal } from "https://esm.sh/react-dom@18.3.1?external=react";
import { KnowledgeDialog } from "./knowledge-ui.mjs?v=20260920-sidebar-v1";
import { Search, Star, FileText, Folder, Settings, GripVertical, MoreHorizontal, ArrowUp, ArrowDown, Trash2 } from "https://esm.sh/lucide-react@0.468.0?external=react";
import { filterFavoriteNotes, moveFavorite, normalizeFavorites, restoreFavorites } from "./favorites-model.mjs?v=20260920-favorites-v1";
const h = React.createElement;
const glyph = (Icon, size = 18) => h(Icon, { size, strokeWidth: 1.7, "aria-hidden": true });
const button = (label, onClick, props = {}) => h("button", { type: "button", onClick, ...props }, label);

export function FavoritesPage({ notes, favorites, availableIds, view = {}, onView, onPosition, onOpen, onChange, onBrowse, onPublish, renderPreview, dirty, saving, persistenceStatus }) {
  const { query = "", tag = "", sort = "manual" } = view;
  const [managing, setManaging] = useState(false), [selected, setSelected] = useState([]), [menu, setMenu] = useState(null), [removed, setRemoved] = useState([]);
  const [drag, setDrag] = useState(null), [target, setTarget] = useState(null);
  const [previewId, setPreviewId] = useState(null);
  const preview = notes.find(note => note.id === previewId);
  const page = useRef(null), position = useRef(view.scrollTop || 0), menuRef = useRef(null), dragRef = useRef(null), timer = useRef(0);
  const items = filterFavoriteNotes(notes, query, tag, sort);
  const tags = [...new Set(notes.flatMap(n => n.tags || []))];
  if (tag && !tags.includes(tag)) tags.push(tag);
  useLayoutEffect(() => { page.current.scrollTop = position.current; return () => onPosition(position.current); }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!menu) return;
    const close = e => { if (!menuRef.current?.contains(e.target)) setMenu(null); };
    const escape = e => { if (e.key === "Escape") setMenu(null); };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [menu]);
  const changeView = next => { position.current = 0; page.current.scrollTop = 0; onView({ ...view, ...next, scrollTop: 0 }); setMenu(null); setSelected([]); };
  const remove = ids => {
    const current = normalizeFavorites(favorites);
    setRemoved(current.noteIds.flatMap((id, index) => ids.includes(id) ? [{ id, index }] : []));
    onChange({ ...current, noteIds: current.noteIds.filter(id => !ids.includes(id)), updatedAt: new Date().toISOString() });
    setSelected([]); setMenu(null); clearTimeout(timer.current); timer.current = setTimeout(() => setRemoved([]), 10000);
  };
  const move = (id, targetId) => onChange(moveFavorite(favorites, id, targetId, new Date().toISOString()));
  const endDrag = (e, cancel = false) => {
    const current = dragRef.current; if (!current || current.pointerId !== e.pointerId) return;
    dragRef.current = null; setDrag(null); setTarget(null);
    if (!cancel && current.target) move(current.id, current.target);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  return h("section", { className: "favorites-page", ref: page, onScroll: e => { position.current = e.currentTarget.scrollTop; }, "aria-label": "收藏笔记列表" },
    h("header", { className: "favorites-header" }, h("div", null, h("h1", null, "收藏"), h("p", null, "把重要的笔记，留在手边。")),
      button([glyph(Settings), managing ? "完成" : "管理"], () => { setManaging(!managing); setSelected([]); setMenu(null); }, { "aria-pressed": managing, className: "favorites-manage" })),
    h("div", { className: "favorites-toolbar" }, h("label", { className: "favorites-search" }, glyph(Search), h("input", { value: query, placeholder: "搜索收藏笔记…", "aria-label": "搜索收藏笔记", onChange: e => changeView({ query: e.target.value }) })),
      h("select", { value: sort, "aria-label": "收藏排序", onChange: e => changeView({ sort: e.target.value }) }, h("option", { value: "manual" }, "手动排序"), h("option", { value: "recent" }, "最近更新"))),
    h("div", { className: "favorites-filter-line" }, h("div", { className: "favorites-tags", "aria-label": "按标签筛选收藏" }, ["", ...tags].map(t => button(t || "全部", () => changeView({ tag: t }), { key: t, "aria-pressed": tag === t }))),
      h("span", { className: "favorites-count" }, `${items.length} 篇${query || tag ? "匹配" : "收藏"}`)),
    managing ? h("div", { className: "favorites-bulk" }, h("label", null, h("input", { type: "checkbox", checked: items.length > 0 && items.every(n => selected.includes(n.id)), disabled: !items.length, onChange: e => setSelected(e.target.checked ? items.map(n => n.id) : []) }), "全选当前结果"), h("span", null, `已选 ${selected.length} 篇`), button("取消收藏", () => remove(selected), { disabled: !selected.length })) : null,
    dirty || persistenceStatus === "error" ? h("div", { className: "favorites-sync", role: "status" }, h("span", null, persistenceStatus === "error" ? "本地保存失败" : persistenceStatus === "saving" ? "正在保存…" : "已保存本地 · 待发布"), button(saving ? "正在发布…" : "发布同步", onPublish, { disabled: saving })) : null,
    h("div", { className: "favorites-list" }, items.map((note, index) => h("article", { key: note.id, "data-favorite-id": note.id, className: `favorite-row${drag === note.id ? " is-dragging" : ""}${target === note.id ? " is-drop-target" : ""}`, "aria-label": note.title },
      managing ? h("input", { type: "checkbox", className: "favorite-select", "aria-label": `选择：${note.title}`, checked: selected.includes(note.id), onChange: e => setSelected(e.target.checked ? [...selected, note.id] : selected.filter(id => id !== note.id)) }) :
        h("button", { type: "button", className: "favorite-drag", disabled: sort !== "manual", "aria-label": `拖拽排序：${note.title}`, title: sort === "manual" ? "拖拽排序，也可使用管理菜单移动" : "切换到手动排序后可拖拽",
          onPointerDown: e => { if (e.button !== 0) return; e.preventDefault(); dragRef.current = { id: note.id, pointerId: e.pointerId, x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); },
          onPointerMove: e => { const current = dragRef.current; if (!current || current.pointerId !== e.pointerId || Math.hypot(e.clientX - current.x, e.clientY - current.y) < 4) return; setDrag(current.id); const id = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-favorite-id]")?.dataset.favoriteId; current.target = id && id !== current.id ? id : null; setTarget(current.target); },
          onPointerUp: e => endDrag(e), onPointerCancel: e => endDrag(e, true), onLostPointerCapture: e => endDrag(e, true) }, glyph(GripVertical)),
      button([h("span", { key: "icon", className: "favorite-document-icon" }, glyph(FileText, 23)), h("span", { key: "copy", className: "favorite-copy" }, h("strong", null, note.title), h("span", { className: "favorite-excerpt" }, note.excerpt || "暂无正文内容"), h("span", { className: "favorite-metadata" }, h("span", { className: "favorite-folder" }, glyph(Folder, 15), note.folderPath || "未分类"), ...(note.tags || []).map(t => h("span", { key: t, className: "favorite-tag" }, t))))], () => { setMenu(null); setPreviewId(note.id); }, { className: "favorite-open", "aria-label": `预览笔记：${note.title}`, "aria-haspopup": "dialog", "aria-expanded": previewId === note.id }),
      h("time", { className: "favorite-date", dateTime: note.date || undefined }, note.date ? `更新于 ${new Date(note.date).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })}` : ""),
      button(glyph(Star, 20), () => remove([note.id]), { className: "favorite-star", "aria-label": `取消收藏：${note.title}`, title: "取消收藏" }),
      h("div", { className: "favorite-menu-anchor", ref: menu === note.id ? menuRef : null }, button(glyph(MoreHorizontal), () => setMenu(menu === note.id ? null : note.id), { "aria-label": `管理：${note.title}`, "aria-expanded": menu === note.id }),
        menu === note.id ? h("div", { className: "favorite-menu" }, button([glyph(ArrowUp), "向前移动"], () => { move(note.id, items[index - 1]?.id); setMenu(null); }, { disabled: sort !== "manual" || !index }), button([glyph(ArrowDown), "向后移动"], () => { move(note.id, items[index + 1]?.id); setMenu(null); }, { disabled: sort !== "manual" || index === items.length - 1 }), button([glyph(Trash2), "取消收藏"], () => remove([note.id]), { className: "favorite-remove" })) : null)))),
    !items.length ? h("div", { className: "favorites-empty" }, glyph(Star, 32), h("h2", null, notes.length ? "没有找到匹配的收藏" : "把值得重读的笔记收藏在这里"), h("p", null, notes.length ? "试试其他关键词或标签。" : "在笔记顶部点击星标，即可加入收藏。"), button(notes.length ? "清除筛选" : "浏览笔记", () => notes.length ? changeView({ query: "", tag: "" }) : onBrowse())) : null,
    removed.length ? h("div", { className: "favorites-undo", role: "status" }, `已取消 ${removed.length} 篇收藏，原笔记保留`, button("撤销", () => { onChange(restoreFavorites(favorites, removed, availableIds, new Date().toISOString())); setRemoved([]); })) : null,
    preview ? createPortal(h("div", { className: "favorite-preview-layer" },
      h(KnowledgeDialog, { title: "笔记预览", className: "favorite-preview", onClose: () => setPreviewId(null) },
        h("div", { className: "favorite-preview-body", tabIndex: 0, "aria-label": "预览正文" },
          h("h1", null, preview.title),
          h("div", { className: "favorite-preview-meta" }, h("span", null, preview.folderPath || "未分类"),
            ...(preview.tags || []).map(tag => h("span", { key: tag, className: "favorite-tag" }, tag))),
          renderPreview(preview)),
        h("footer", null, button("打开笔记", () => { onPosition(position.current); setPreviewId(null); onOpen(preview.id); }, { className: "primary-btn" })))), document.body) : null);
}
