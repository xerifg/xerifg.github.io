export const boardColors = ["#ffffff", "#dbeafe", "#dcfce7", "#fef3c7", "#fce7f3", "#ede9fe"];
export const boardId = () => crypto.randomUUID();
const number = (value, fallback, min, max) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;
const text = (value, max = 10000) => typeof value === "string" ? value.slice(0, max) : "";
export const escapeBoardHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
export function safeBoardImage(src) {
  return /^(https?:\/\/|blob:|data:image\/(?:png|jpeg|gif|webp|avif|svg\+xml)[;,]|\/?(?:notebooks|api\/local-assets)\/|draft-asset:|assets\/)/i.test(String(src)) ? String(src) : "";
}
export function normalizeBoard(value) {
  if (typeof value === "string") { try { value = JSON.parse(value); } catch { value = {}; } }
  const source = value && typeof value === "object" ? value : {};
  const ids = new Set();
  const nodes = (Array.isArray(source.nodes) ? source.nodes : []).filter(node => {
    if (!node || !["text", "image", "note", "group"].includes(node.type) || typeof node.id !== "string" || ids.has(node.id)) return false;
    ids.add(node.id); return true;
  }).map(node => ({ id: node.id, type: node.type,
    x: number(node.x, 0, -100000, 100000), y: number(node.y, 0, -100000, 100000),
    width: number(node.width, 260, 100, 5000), height: number(node.height, 160, 64, 5000),
    color: boardColors.includes(node.color) ? node.color : node.type === "group" ? "#dbeafe" : "#ffffff",
    text: text(node.text), title: text(node.title, 300), src: safeBoardImage(node.src), noteId: text(node.noteId, 300)
  }));
  const edgeIds = new Set();
  const edges = (Array.isArray(source.edges) ? source.edges : []).filter(edge => {
    if (!edge || typeof edge.id !== "string" || edgeIds.has(edge.id) || !ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to) return false;
    edgeIds.add(edge.id); return true;
  }).map(edge => ({ id: edge.id, from: edge.from, to: edge.to, label: text(edge.label, 300), arrow: edge.arrow !== false,
    fromSide: ["top", "right", "bottom", "left"].includes(edge.fromSide) ? edge.fromSide : "right",
    toSide: ["top", "right", "bottom", "left"].includes(edge.toSide) ? edge.toSide : "left" }));
  return { version: 1, id: text(source.id, 100), title: text(source.title, 300) || "未命名白板", nodes, edges };
}
export const createBoard = () => ({ version: 1, id: boardId(), title: "未命名白板", nodes: [], edges: [] });
export function boardBounds(nodes) {
  if (!nodes.length) return { x: -40, y: -40, width: 640, height: 360 };
  const x = Math.min(...nodes.map(n => n.x)) - 40, y = Math.min(...nodes.map(n => n.y)) - 40;
  return { x, y, width: Math.max(240, Math.max(...nodes.map(n => n.x + n.width)) - x + 40), height: Math.max(180, Math.max(...nodes.map(n => n.y + n.height)) - y + 40) };
}
export function boardPort(node, side) {
  return { x: node.x + (side === "left" ? 0 : side === "right" ? node.width : node.width / 2),
    y: node.y + (side === "top" ? 0 : side === "bottom" ? node.height : node.height / 2) };
}
export function boardConnectionTarget(nodes, sourceId, point, zoom) {
  // Match the visual stacking order; snapping stays within 22 screen pixels at any zoom.
  const candidates = [...nodes.filter(n => n.type !== "group").reverse(), ...nodes.filter(n => n.type === "group").reverse()];
  for (const node of candidates) {
    const ports = ["top", "right", "bottom", "left"].map(side => {
      const port = boardPort(node, side);
      return { nodeId: node.id, side, point: port, distance: Math.hypot(point.x - port.x, point.y - port.y) };
    }).sort((a, b) => a.distance - b.distance);
    const inside = point.x >= node.x && point.x <= node.x + node.width && point.y >= node.y && point.y <= node.y + node.height;
    if (inside || ports[0].distance * zoom <= 22) return node.id === sourceId ? null : ports[0];
  }
  return null;
}
export function boardNearbyConnectionNode(nodes, sourceId, point, zoom) {
  const candidates = [...nodes.filter(n => n.type !== "group").reverse(), ...nodes.filter(n => n.type === "group").reverse()];
  let nearest = null, distance = 64;
  for (const node of candidates) {
    if (node.id === sourceId) continue;
    const dx = Math.max(node.x - point.x, 0, point.x - node.x - node.width);
    const dy = Math.max(node.y - point.y, 0, point.y - node.y - node.height);
    const screenDistance = Math.hypot(dx, dy) * zoom;
    if (screenDistance < distance) { nearest = node.id; distance = screenDistance; }
  }
  return nearest;
}
export function boardEdgePath(edge, nodes) {
  const from = nodes.find(n => n.id === edge.from), to = nodes.find(n => n.id === edge.to);
  if (!from || !to) return null;
  const a = boardPort(from, edge.fromSide), b = boardPort(to, edge.toSide);
  const distance = Math.max(40, Math.hypot(b.x - a.x, b.y - a.y) / 3);
  const control = (p, side) => ({ x: p.x + (side === "left" ? -distance : side === "right" ? distance : 0), y: p.y + (side === "top" ? -distance : side === "bottom" ? distance : 0) });
  const c = control(a, edge.fromSide), d = control(b, edge.toSide);
  return { path: `M ${a.x} ${a.y} C ${c.x} ${c.y} ${d.x} ${d.y} ${b.x} ${b.y}`, x: (a.x + 3*c.x + 3*d.x + b.x)/8, y: (a.y + 3*c.y + 3*d.y + b.y)/8 };
}
export function deleteBoardItems(board, ids) {
  return { ...board, nodes: board.nodes.filter(n => !ids.includes(n.id)), edges: board.edges.filter(e => !ids.includes(e.id) && !ids.includes(e.from) && !ids.includes(e.to)) };
}
export function duplicateBoardItems(board, ids, makeId = boardId) {
  const mapping = new Map(board.nodes.filter(n => ids.includes(n.id)).map(n => [n.id, makeId()]));
  const nodes = board.nodes.filter(n => mapping.has(n.id)).map(n => ({ ...n, id: mapping.get(n.id), x: n.x + 32, y: n.y + 32 }));
  const edges = board.edges.filter(e => mapping.has(e.from) && mapping.has(e.to)).map(e => ({ ...e, id: makeId(), from: mapping.get(e.from), to: mapping.get(e.to) }));
  return { board: { ...board, nodes: [...board.nodes, ...nodes], edges: [...board.edges, ...edges] }, ids: [...mapping.values()] };
}
export function moveBoardItems(board, ids, dx, dy) {
  const moving = new Set(ids);
  for (const group of board.nodes.filter(n => n.type === "group" && moving.has(n.id))) {
    board.nodes.filter(n => n.x >= group.x && n.y >= group.y && n.x + n.width <= group.x + group.width && n.y + n.height <= group.y + group.height).forEach(n => moving.add(n.id));
  }
  return { ...board, nodes: board.nodes.map(n => moving.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n) };
}
export function boardCardHTML(node) {
  const e = escapeBoardHTML;
  if (node.type === "image") return `<img src="${e(node.src)}" alt="${e(node.title || "白板图片")}" draggable="false">`;
  if (node.type === "note") return `<a href="#note/${encodeURIComponent(node.noteId)}">${e(node.title || "笔记引用")}</a><p>${e(node.text)}</p>`;
  return node.type === "group" ? `<strong>${e(node.title || "分组")}</strong>` : `<p>${e(node.text || "双击输入文字")}</p>`;
}
export function boardPreviewHTML(value) {
  const board = normalizeBoard(value), bounds = boardBounds(board.nodes), e = escapeBoardHTML;
  const marker = `wb-arrow-${board.id.replace(/[^\w-]/g, "")}`;
  const edges = board.edges.map(edge => {
    const line = boardEdgePath(edge, board.nodes);
    return `<path d="${line.path}" fill="none" stroke="#8291a7" stroke-width="2" ${edge.arrow ? `marker-end="url(#${marker})"` : ""}/><text x="${line.x}" y="${line.y - 8}" text-anchor="middle" fill="#52637a" font-size="14">${e(edge.label)}</text>`;
  }).join("");
  const cards = board.nodes.slice().sort((a,b) => (a.type !== "group") - (b.type !== "group")).map(node => `<foreignObject x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}"><div xmlns="http://www.w3.org/1999/xhtml" class="wb-card wb-card-${node.type}" style="background:${node.color}">${boardCardHTML(node)}</div></foreignObject>`).join("");
  return `<div class="wb-preview" aria-label="白板预览"><svg viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}" role="img" aria-label="${e(board.title)}"><defs><marker id="${marker}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#8291a7"/></marker></defs>${cards}${edges}</svg>${board.nodes.length ? "" : '<span class="wb-empty-preview">添加卡片、图片与连线，整理你的思路</span>'}</div>`;
}
