import React, { useEffect, useRef, useState } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import { boardId, boardColors, normalizeBoard, boardBounds, boardPort, boardConnectionTarget, boardNearbyConnectionNode, boardEdgePath, deleteBoardItems, duplicateBoardItems, moveBoardItems } from "./whiteboard-model.mjs?v=20260919-whiteboard-v7";

const h = React.createElement;
const button = (label, onClick, props = {}) => h("button", { type: "button", onClick, ...props }, label);
const isInput = target => Boolean(target.closest("input,textarea,select,[contenteditable=true]"));
const sideNames = { top: "上", right: "右", bottom: "下", left: "左" };

export function openWhiteboard({ board, notes = [], readOnly = false, onChange, onImage, onOpenNote, onClose }) {
  const mount = document.createElement("div");
  const previousFocus = document.activeElement;
  const app = document.getElementById("app");
  const previousInert = app?.inert;
  if (app) app.inert = true;
  document.body.append(mount);
  const root = createRoot(mount);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    root.unmount(); mount.remove();
    if (app) app.inert = previousInert;
    if (previousFocus?.isConnected) previousFocus.focus();
    onClose?.();
  };
  root.render(h(WhiteboardDialog, { initial: normalizeBoard(board), notes, readOnly, onChange, onImage, onOpenNote: id => { close(); onOpenNote?.(id); }, close }));
  return close;
}

function WhiteboardDialog({ initial, notes, readOnly, onChange, onImage, onOpenNote, close }) {
  const [board, setBoard] = useState(initial);
  const boardRef = useRef(board); boardRef.current = board;
  const [selection, setSelection] = useState([]);
  const selected = useRef(selection); selected.current = selection;
  const [viewport, setViewport] = useState({ x: 60, y: 60, zoom: 1 });
  const camera = useRef(viewport); camera.current = viewport;
  const [tool, setTool] = useState("select");
  const [query, setQuery] = useState(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [guide, setGuide] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const inlineInput = useRef(null);
  const stage = useRef(null), dialog = useRef(null), imageInput = useRef(null), textInput = useRef(null);
  const gesture = useRef(null), space = useRef(false), alive = useRef(true), clipboard = useRef(null);
  const history = useRef({ undo: [], redo: [], key: "", time: 0 });
  const [, renderHistory] = useState(0);
  useEffect(() => {
    if (!editingId || !inlineInput.current) return;
    inlineInput.current.focus({ preventScroll: true });
    const end = inlineInput.current.value.length;
    inlineInput.current.setSelectionRange(end, end);
  }, [editingId]);
  const finishInlineEdit = () => { setEditingId(null); stage.current?.focus(); };
  const display = next => { boardRef.current = next; setBoard(next); };
  const save = next => {
    try { onChange?.(next); setStatus("已更新正文"); }
    catch (error) { setStatus(`保存失败：${error.message}`); }
  };
  const commit = (next, base = boardRef.current, key = "") => {
    if (readOnly || JSON.stringify(next) === JSON.stringify(base)) return;
    const stack = history.current;
    if (!key || key !== stack.key || Date.now() - stack.time > 800) {
      stack.undo.push(base); if (stack.undo.length > 100) stack.undo.shift();
    }
    stack.redo = []; stack.key = key; stack.time = Date.now();
    display(next); save(next); renderHistory(n => n + 1);
  };
  const undo = redo => {
    if (readOnly) return;
    const stack = history.current, from = redo ? stack.redo : stack.undo, to = redo ? stack.undo : stack.redo;
    if (!from.length) return;
    to.push(boardRef.current); const next = from.pop(); stack.key = "";
    display(next); save(next); setSelection([]); renderHistory(n => n + 1);
  };
  const updateNode = (id, attrs, key = "") => commit({ ...boardRef.current, nodes: boardRef.current.nodes.map(n => n.id === id ? { ...n, ...attrs } : n) }, boardRef.current, key);
  const updateEdge = (id, attrs, key = "") => commit({ ...boardRef.current, edges: boardRef.current.edges.map(e => e.id === id ? { ...e, ...attrs } : e) }, boardRef.current, key);
  const remove = () => { commit(deleteBoardItems(boardRef.current, selected.current)); setSelection([]); };
  const duplicate = () => {
    const result = duplicateBoardItems(boardRef.current, selected.current);
    commit(result.board); setSelection(result.ids);
  };
  const point = event => {
    const rect = stage.current.getBoundingClientRect(), view = camera.current;
    return { x: (event.clientX - rect.left - view.x) / view.zoom, y: (event.clientY - rect.top - view.y) / view.zoom };
  };
  const fit = () => {
    if (!stage.current) return;
    const bounds = boardBounds(boardRef.current.nodes), rect = stage.current.getBoundingClientRect();
    const zoom = Math.max(.1, Math.min(1, (rect.width - 80) / bounds.width, (rect.height - 80) / bounds.height));
    setViewport({ zoom, x: (rect.width - bounds.width * zoom) / 2 - bounds.x * zoom, y: (rect.height - bounds.height * zoom) / 2 - bounds.y * zoom });
  };
  const zoomAt = (factor, x, y) => {
    setViewport(old => {
      const zoom = Math.min(3, Math.max(.1, old.zoom * factor));
      return { zoom, x: x - (x - old.x) * zoom / old.zoom, y: y - (y - old.y) * zoom / old.zoom };
    });
  };
  const add = (type, attrs = {}, location) => {
    const rect = stage.current.getBoundingClientRect(), view = camera.current;
    const pos = location || { x: (rect.width / 2 - view.x) / view.zoom - 130, y: (rect.height / 2 - view.y) / view.zoom - 80 };
    const node = { id: boardId(), type, x: pos.x, y: pos.y, width: 260, height: 160, text: "", title: "", color: "#ffffff", ...attrs };
    commit({ ...boardRef.current, nodes: [...boardRef.current.nodes, node] });
    setSelection([node.id]); setTool("select"); setQuery(null);
    setEditingId(type === "text" ? node.id : null);
  };
  const addGroup = () => {
    const items = boardRef.current.nodes.filter(n => selected.current.includes(n.id));
    const bounds = items.length ? boardBounds(items) : null;
    add("group", { title: "新分组", color: "#dbeafe", width: bounds?.width || 560, height: bounds?.height || 360 }, bounds);
  };
  const upload = async file => {
    if (!file || !file.type.startsWith("image/") || readOnly || busy) return;
    setBusy(true); setStatus("正在保存图片…");
    try {
      const asset = await onImage(file);
      if (!alive.current) return;
      const src = asset.localUrl || asset.dataUrl || asset.remotePath;
      const picture = new Image(); picture.src = src; await picture.decode();
      if (!alive.current) return;
      const width = Math.max(100, Math.min(320, picture.naturalWidth));
      add("image", { src, title: file.name, width, height: Math.max(64, width * picture.naturalHeight / picture.naturalWidth) });
    } catch (error) { if (alive.current) setStatus(`图片插入失败：${error.message}`); }
    finally { if (alive.current) setBusy(false); }
  };
  const focusCardText = node => {
    if (node.type === "note") {
      if (notes.some(n => n.id === node.noteId)) onOpenNote(node.noteId);
      else setStatus("引用的笔记暂不可用");
      return;
    }
    if (readOnly) return;
    setQuery(null); setSelection([node.id]);
    if (node.type === "text") { setTool("select"); setEditingId(node.id); }
    else requestAnimationFrame(() => textInput.current?.focus());
  };
  const down = event => {
    if (event.button !== 0 && event.button !== 1) return;
    if (isInput(event.target)) return;
    event.preventDefault();
    stage.current.focus();
    const start = point(event), nodeElement = event.target.closest("[data-node-id]"), node = boardRef.current.nodes.find(n => n.id === nodeElement?.dataset.nodeId);
    const port = event.target.closest("[data-port]");
    let mode;
    if (event.button === 1 || space.current || tool === "pan" || (readOnly && !node)) mode = "pan";
    else if (!readOnly && node && (port || tool === "connect")) mode = "connect";
    else if (!readOnly && node && event.target.closest(".wb-resize")) mode = "resize";
    else if (node) mode = readOnly ? "select" : "move";
    else if (event.target.closest("[data-edge-id]")) {
      setSelection([event.target.closest("[data-edge-id]").dataset.edgeId]); return;
    } else mode = readOnly ? "pan" : "box";
    let ids = selection;
    if (node && mode !== "pan") {
      ids = event.shiftKey ? (selection.includes(node.id) ? selection.filter(id => id !== node.id) : [...selection, node.id]) : selection.includes(node.id) ? selection : [node.id];
      setSelection(ids);
    } else if (mode === "box" && !event.shiftKey) { ids = []; setSelection([]); }
    // Keep click/dblclick targeted at the card while capturing its drag events.
    const captureTarget = nodeElement || stage.current;
    gesture.current = { mode, start, clientX: event.clientX, clientY: event.clientY, base: boardRef.current, viewport: camera.current, node, ids, side: port?.dataset.port || "right", moved: false, pointerId: event.pointerId, captureTarget };
    if (mode === "connect") setGuide({ type: "line", sourceId: node.id, fromSide: gesture.current.side, from: boardPort(node, gesture.current.side), to: start });
    captureTarget.setPointerCapture(event.pointerId);
  };
  const connectionTarget = (event, g) => {
    if (document.elementFromPoint(event.clientX, event.clientY)?.closest(".wb-stage") !== stage.current) return null;
    return boardConnectionTarget(g.base.nodes, g.node.id, point(event), camera.current.zoom);
  };
  const move = event => {
    const g = gesture.current; if (!g || g.pointerId !== event.pointerId) return;
    const p = point(event), dx = p.x - g.start.x, dy = p.y - g.start.y;
    if (!g.moved && Math.hypot(event.clientX - g.clientX, event.clientY - g.clientY) < 3) return;
    g.moved = true;
    if (g.mode === "pan") setViewport({ ...g.viewport, x: g.viewport.x + event.clientX - g.clientX, y: g.viewport.y + event.clientY - g.clientY });
    if (g.mode === "move") display(moveBoardItems(g.base, g.ids, dx, dy));
    if (g.mode === "resize") {
      const width = Math.max(120, g.node.width + dx), height = g.node.type === "image" ? width * g.node.height / g.node.width : Math.max(80, g.node.height + dy);
      display({ ...g.base, nodes: g.base.nodes.map(n => n.id === g.node.id ? { ...n, width, height } : n) });
    }
    if (g.mode === "box") {
      const box = { x: Math.min(g.start.x,p.x), y: Math.min(g.start.y,p.y), width: Math.abs(dx), height: Math.abs(dy) };
      setGuide({ type: "box", ...box });
      setSelection([...new Set([...g.ids, ...g.base.nodes.filter(n => n.x < box.x + box.width && n.y < box.y + box.height && n.x + n.width > box.x && n.y + n.height > box.y).map(n => n.id)])]);
    }
    if (g.mode === "connect") {
      const target = connectionTarget(event, g);
      const nearbyId = target?.nodeId || (document.elementFromPoint(event.clientX,event.clientY)?.closest(".wb-stage") === stage.current ? boardNearbyConnectionNode(g.base.nodes, g.node.id, p, camera.current.zoom) : null);
      const path = target ? boardEdgePath({ from: g.node.id, fromSide: g.side, to: target.nodeId, toSide: target.side }, g.base.nodes).path : null;
      setGuide({ type: "line", sourceId: g.node.id, fromSide: g.side, from: boardPort(g.node,g.side), to: target?.point || p, target, path, nearbyId });
    }
  };
  const end = (event, cancel = false) => {
    const g = gesture.current; if (!g) return;
    gesture.current = null; setGuide(null);
    if (g.captureTarget.hasPointerCapture(g.pointerId)) g.captureTarget.releasePointerCapture(g.pointerId);
    if (cancel) { display(g.base); return; }
    if (g.moved && ["move", "resize"].includes(g.mode)) commit(boardRef.current,g.base);
    if (g.mode === "connect" && g.moved) {
      const target = connectionTarget(event, g);
      if (target) {
        const edge = { id: boardId(), from: g.node.id, to: target.nodeId, fromSide: g.side, toSide: target.side, arrow: true, label: "" };
        commit({ ...boardRef.current, edges: [...boardRef.current.edges,edge] }); setSelection([edge.id]);
      }
    }
  };
  const copySelection = event => {
    if (isInput(document.activeElement) || !selected.current.length) return;
    const copied = {...boardRef.current,nodes:boardRef.current.nodes.filter(n=>selected.current.includes(n.id))};
    if (!copied.nodes.length) return;
    const plain = copied.nodes.map(n=>n.text || n.title || "卡片").join("\n");
    clipboard.current = {board:copied,plain};
    event.preventDefault(); event.stopPropagation();
    event.clipboardData.setData("application/x-notebook-whiteboard",JSON.stringify(copied));
    event.clipboardData.setData("text/plain",plain);
  };
  const actions = useRef({}); actions.current = { undo, remove, duplicate, close, end, copySelection, editingId, finishInlineEdit };
  useEffect(() => {
    alive.current = true;
    fit(); document.getSelection()?.removeAllRanges(); dialog.current.querySelector("button")?.focus();
    const keydown = event => {
      if (event.isComposing || event.keyCode === 229) return;
      if (event.key === "Tab") {
        const items = [...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea,select,[tabindex="0"]')].filter(el => el.getClientRects().length);
        const index = items.indexOf(document.activeElement);
        if (event.shiftKey && index <= 0) { event.preventDefault(); items.at(-1)?.focus(); }
        else if (!event.shiftKey && index === items.length-1) { event.preventDefault(); items[0]?.focus(); }
      }
      if (event.key === "Escape") {
        event.preventDefault(); event.stopPropagation();
        if (gesture.current) actions.current.end(event,true);
        else if (actions.current.editingId) actions.current.finishInlineEdit();
        else actions.current.close();
        return;
      }
      if (event.code === "Space" && !isInput(event.target)) { space.current = true; event.preventDefault(); }
      if (readOnly || isInput(event.target)) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); actions.current.undo(event.shiftKey); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") { event.preventDefault(); actions.current.undo(true); }
      if (["Delete","Backspace"].includes(event.key)) { event.preventDefault(); actions.current.remove(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") { event.preventDefault(); actions.current.duplicate(); }
    };
    const keyup = event => { if (event.code === "Space") space.current = false; };
    const copy = event => actions.current.copySelection(event);
    const blur = () => { space.current = false; if (gesture.current) actions.current.end({},true); };
    document.addEventListener("keydown",keydown,true); document.addEventListener("keyup",keyup,true); document.addEventListener("copy",copy,true); window.addEventListener("blur",blur);
    return () => { alive.current = false; document.removeEventListener("keydown",keydown,true); document.removeEventListener("keyup",keyup,true); document.removeEventListener("copy",copy,true); window.removeEventListener("blur",blur); };
  }, []);
  useEffect(() => {
    const wheel = event => {
      if (event.target.closest(".wb-inline-text") && !event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = stage.current.getBoundingClientRect();
      if (event.ctrlKey || event.metaKey) {
        // Normalize line/page deltas and cap large wheel ticks to avoid sudden jumps.
        const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
        const delta = Math.max(-100, Math.min(100, pixels));
        zoomAt(Math.exp(-delta*.001),event.clientX-rect.left,event.clientY-rect.top);
      }
      else setViewport(v => ({ ...v, x:v.x-event.deltaX, y:v.y-event.deltaY }));
    };
    stage.current.addEventListener("wheel",wheel,{passive:false});
    return () => stage.current?.removeEventListener("wheel",wheel);
  }, []);
  const item = selection.length === 1 ? board.nodes.find(n => n.id === selection[0]) : null;
  const edge = selection.length === 1 ? board.edges.find(n => n.id === selection[0]) : null;
  const setToolButton = (label, name) => button(label, () => setTool(name), { "aria-pressed":tool === name });
  const card = node => h("div", { key:node.id, "data-node-id":node.id, className:`wb-node wb-node-${node.type}${selection.includes(node.id) ? " is-selected" : ""}${guide?.target?.nodeId===node.id ? " is-connect-target" : ""}${guide?.nearbyId===node.id ? " is-connect-near" : ""}`, style:{left:node.x,top:node.y,width:node.width,height:node.height},
    onDoubleClick: event => { event.stopPropagation(); if (!isInput(event.target)) focusCardText(node); } },
    h("div", { className:`wb-card wb-card-${node.type}`, style:{background:node.color} },
      node.type === "image" ? h("img", { src:node.src,alt:node.title || "白板图片",draggable:false })
      : node.type === "note" ? [h("strong",{key:"title"},notes.find(n=>n.id===node.noteId)?.title || node.title || "笔记引用"),h("p",{key:"text"},node.text),h("small",{key:"hint"},notes.some(n=>n.id===node.noteId) ? "双击打开笔记 ↗" : "引用的笔记暂不可用")]
      : node.type === "group" ? h("strong",null,node.title || "分组")
      : !readOnly && editingId === node.id ? h("textarea",{ref:inlineInput,className:"wb-inline-text","aria-label":"卡片文字",value:node.text,placeholder:"输入文字…",onChange:e=>updateNode(node.id,{text:e.target.value},`text-${node.id}`),onBlur:()=>setEditingId(current=>current===node.id?null:current)})
      : h("p",null,node.text || "双击输入文字")),
    !readOnly ? ["top","right","bottom","left"].map(side => h("button", { key:side,type:"button",className:`wb-port wb-port-${side}${guide?.target?.nodeId===node.id && guide.target.side===side ? " is-target" : ""}${guide?.sourceId===node.id && guide.fromSide===side ? " is-source" : ""}`,"data-port":side,"aria-label":`从${sideNames[side]}侧拖动连线`,tabIndex:-1 })) : null,
    !readOnly && selection.includes(node.id) ? h("button",{className:"wb-resize","aria-label":"拖动调整卡片大小",tabIndex:-1}) : null);
  return h("div",{className:"wb-backdrop"},h("section",{ref:dialog,className:"wb-dialog",role:"dialog","aria-modal":true,"aria-label":readOnly ? "查看白板" : "编辑白板",onPaste:event => {
    if (readOnly || isInput(event.target)) return;
    const file = [...(event.clipboardData?.files || [])].find(f=>f.type.startsWith("image/"));
    if (file) { event.preventDefault(); upload(file); }
    else {
      const data = event.clipboardData?.getData("application/x-notebook-whiteboard"), plain = event.clipboardData?.getData("text/plain");
      const source = data ? normalizeBoard(data) : clipboard.current?.plain === plain ? clipboard.current.board : null;
      if (!source) { if(plain){event.preventDefault();add("text",{text:plain});} return; }
      event.preventDefault(); const copied = duplicateBoardItems(source,source.nodes.map(n=>n.id));
      const ids = copied.ids;
      const nodes = copied.board.nodes.filter(n=>ids.includes(n.id)), edges = copied.board.edges.filter(e=>ids.includes(e.from)&&ids.includes(e.to));
      commit({...boardRef.current,nodes:[...boardRef.current.nodes,...nodes],edges:[...boardRef.current.edges,...edges]}); setSelection(ids);
      clipboard.current = {board:{...source,nodes,edges},plain};
    }
  }},
    h("header",{className:"wb-header"},button("← 返回正文",close),readOnly ? h("strong",null,board.title) : h("input",{className:"wb-title","aria-label":"白板名称",value:board.title,onChange:e=>commit({...boardRef.current,title:e.target.value},boardRef.current,"title")}),
      h("span",{className:"wb-status",role:"status"},readOnly ? "只读" : status),
      !readOnly ? button("撤销",()=>undo(false),{disabled:!history.current.undo.length}) : null,
      !readOnly ? button("重做",()=>undo(true),{disabled:!history.current.redo.length}) : null),
    h("div",{className:"wb-body"},
      h("nav",{className:"wb-tools","aria-label":"白板工具"},setToolButton("选择","select"),setToolButton("平移","pan"),
        !readOnly ? [button("文本",()=>add("text"),{key:"text"}),button(busy ? "上传中…" : "图片",()=>imageInput.current.click(),{key:"image",disabled:busy}),button("笔记引用",()=>setQuery(""),{key:"note"}),h(React.Fragment,{key:"connect"},setToolButton("连线","connect")),button("分组",addGroup,{key:"group"})] : null),
      h("div",{className:`wb-stage${tool==="pan"?" is-pan":""}${guide?.type==="line"?" is-connecting":""}`,ref:stage,tabIndex:0,"aria-label":"白板画布",style:{backgroundSize:`${24*viewport.zoom}px ${24*viewport.zoom}px`,backgroundPosition:`${viewport.x}px ${viewport.y}px`},
        onPointerDown:down,onPointerMove:move,onPointerUp:event=>end(event),onPointerCancel:event=>end(event,true),onLostPointerCapture:event=>{if(gesture.current)end(event,true);},
        onDoubleClick:event=>{if(!readOnly && event.target===stage.current)add("text",{},point(event));}},
        h("div",{className:"wb-world",style:{transform:`translate(${viewport.x}px,${viewport.y}px) scale(${viewport.zoom})`}},
          ...board.nodes.filter(n=>n.type==="group").map(card),
          h("svg",{className:"wb-edges"},h("defs",null,h("marker",{id:"wb-live-arrow",viewBox:"0 0 10 10",refX:9,refY:5,markerWidth:8,markerHeight:8,orient:"auto-start-reverse"},h("path",{d:"M 0 0 L 10 5 L 0 10 z",fill:"#7c8ba3"}))),
            ...board.edges.map(e=>{const line=boardEdgePath(e,board.nodes);return h("g",{key:e.id,"data-edge-id":e.id,className:selection.includes(e.id)?"is-selected":""},h("path",{className:"wb-edge-hit",d:line.path}),h("path",{className:"wb-edge-line",d:line.path,markerEnd:e.arrow?"url(#wb-live-arrow)":undefined}),h("text",{x:line.x,y:line.y-10,textAnchor:"middle"},e.label));}),
            guide?.type==="line" ? h("g",null,
              h("defs",null,h("marker",{id:"wb-guide-arrow",viewBox:"0 0 10 10",refX:9,refY:5,markerWidth:7,markerHeight:7,orient:"auto"},h("path",{d:"M 0 0 L 10 5 L 0 10 z",fill:"#3370ff"}))),
              h("path",{className:"wb-connection-guide",d:guide.path || `M ${guide.from.x} ${guide.from.y} L ${guide.to.x} ${guide.to.y}`,fill:"none",stroke:"#3370ff",strokeWidth:2,strokeDasharray:guide.target?undefined:"5 5",markerEnd:"url(#wb-guide-arrow)"})) : null),
          ...board.nodes.filter(n=>n.type!=="group").map(card),
          guide?.type==="box" ? h("div",{className:"wb-selection-box",style:{left:guide.x,top:guide.y,width:guide.width,height:guide.height}}) : null),
        guide?.type==="line" ? h("div",{className:"wb-connect-hint",role:"status"},guide.target ? `松开连接到高亮卡片的${sideNames[guide.target.side]}侧锚点` : "拖向目标锚点 · Esc 取消") : null,
        !board.nodes.length ? h("div",{className:"wb-empty"},h("strong",null,"把想法放到画布上"),h("p",null,readOnly ? "这块白板还没有内容" : "添加文本、图片或笔记，拖动卡片边缘连接思路")) : null),
      query !== null && !readOnly ? h("aside",{className:"wb-inspector"},h("div",{className:"wb-inspector-heading"},h("strong",null,"插入笔记引用"),button("关闭",()=>setQuery(null))),h("input",{autoFocus:true,placeholder:"搜索笔记标题",value:query,onChange:e=>setQuery(e.target.value)}),
        ...notes.filter(n=>n.title.toLowerCase().includes(query.toLowerCase())).slice(0,30).map(n=>button(n.title,()=>add("note",{noteId:n.id,title:n.title,text:(n.html||"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").slice(0,240)}),{key:n.id,className:"wb-note-result"})),
        !notes.some(n=>n.title.toLowerCase().includes(query.toLowerCase())) ? h("p",null,"没有匹配的笔记") : null)
      : !readOnly && selection.length ? h("aside",{className:"wb-inspector"},h("strong",null,item ? {text:"文本卡片",image:"图片",note:"笔记引用",group:"分组"}[item.type] : edge ? "连接线" : `已选中 ${selection.length} 项`),
        item && ["group","image"].includes(item.type) ? h("label",null,"名称",h("input",{ref:textInput,value:item.title,onChange:e=>updateNode(item.id,{title:e.target.value},`name-${item.id}`)})) : null,
        item?.type==="note" ? button("打开引用笔记",()=>onOpenNote(item.noteId),{disabled:!notes.some(n=>n.id===item.noteId)}) : null,
        item && item.type!=="image" ? h("div",{className:"wb-colors","aria-label":"卡片颜色"},boardColors.map((color,index)=>button("",()=>updateNode(item.id,{color}),{key:color,style:{background:color},"aria-label":`颜色${index+1}`,"aria-pressed":item.color===color}))) : null,
        edge ? [h("label",{key:"label"},"连线说明",h("input",{value:edge.label,onChange:e=>updateEdge(edge.id,{label:e.target.value},`edge-${edge.id}`)})),h("label",{key:"arrow",className:"wb-check"},h("input",{type:"checkbox",checked:edge.arrow,onChange:e=>updateEdge(edge.id,{arrow:e.target.checked})}),"显示箭头")] : null,
        !edge ? button("复制所选卡片",duplicate) : null,button("删除所选",remove,{className:"wb-delete"})) : null),
    h("footer",{className:"wb-footer"},h("span",null,readOnly ? "空格拖动平移 · Ctrl / ⌘ + 滚轮缩放" : "双击编辑 · Shift 多选 · 空格拖动平移 · Ctrl / ⌘ + 滚轮缩放"),h("div",null,
      button("−",()=>{const r=stage.current.getBoundingClientRect();zoomAt(1/1.2,r.width/2,r.height/2);},{"aria-label":"缩小画布"}),h("span",null,`${Math.round(viewport.zoom*100)}%`),button("＋",()=>{const r=stage.current.getBoundingClientRect();zoomAt(1.2,r.width/2,r.height/2);},{"aria-label":"放大画布"}),button("适应全部",fit))),
    h("input",{ref:imageInput,type:"file",accept:"image/*",hidden:true,onChange:e=>{upload(e.target.files[0]);e.target.value="";}})
  ));
}
