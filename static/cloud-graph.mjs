import React, { useEffect, useRef, useState } from "https://esm.sh/react@18.3.1";
import { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY } from "https://esm.sh/d3-force@3.0.0";

const h = React.createElement;
const button = (label, onClick, extra = {}) => h("button", { type: "button", onClick, ...extra }, label);

export function Graph({ data, selected, onSelect }) {
  const svg = useRef(null), simulation = useRef(null), model = useRef({ nodes: [], edges: [] });
  const gesture = useRef(null), suppressClick = useRef(false);
  const [layout, setLayout] = useState({ nodes: [], edges: [] });
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const camera = useRef(view);
  const [hovered, setHovered] = useState(null), [dragging, setDragging] = useState(null);
  const reducedMotion = useRef(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const paint = () => setLayout({ nodes: [...model.current.nodes], edges: model.current.edges });
  const moveCamera = next => { camera.current = next; setView(next); };
  const fit = (nodes = model.current.nodes) => {
    if (!nodes.length) { moveCamera({ x: 0, y: 0, zoom: 1 }); return; }
    const left = Math.min(...nodes.map(n => n.x)) - 90, right = Math.max(...nodes.map(n => n.x)) + 90;
    const top = Math.min(...nodes.map(n => n.y)) - 45, bottom = Math.max(...nodes.map(n => n.y)) + 60;
    const zoom = Math.min(1.5, 740 / (right - left), 440 / (bottom - top));
    moveCamera({ zoom, x: 400 - (left + right) / 2 * zoom, y: 250 - (top + bottom) / 2 * zoom });
  };
  useEffect(() => {
    const previous = new Map(model.current.nodes.map(n => [n.slug, n]));
    const nodes = data.nodes.map((n, i) => {
      const old = previous.get(n.slug), angle = i * 2.399963, radius = 32 * Math.sqrt(i);
      return { ...n, x: old?.x ?? 400 + Math.cos(angle) * radius, y: old?.y ?? 250 + Math.sin(angle) * radius };
    });
    const ids = new Set(nodes.map(n => n.slug));
    const edges = data.edges.filter(e => ids.has(e.source) && ids.has(e.target)).map(e => ({ ...e }));
    const degree = new Map(nodes.map(n => [n.slug, 0]));
    edges.forEach(e => { degree.set(e.source, degree.get(e.source) + 1); degree.set(e.target, degree.get(e.target) + 1); });
    nodes.forEach(n => { n.radius = 7 + Math.min(6, Math.sqrt(degree.get(n.slug)) * 2); });
    const sim = forceSimulation(nodes).stop().alphaDecay(.045).velocityDecay(.45)
      .force("links", forceLink(edges).id(n => n.slug).distance(105).strength(.18))
      .force("charge", forceManyBody().strength(-220).distanceMax(600))
      .force("collision", forceCollide(n => n.radius + 24).iterations(2))
      .force("x", forceX(400).strength(.025)).force("y", forceY(250).strength(.035));
    model.current = { nodes, edges }; simulation.current = sim;
    sim.tick(previous.size ? 20 : 100); paint();
    if (!nodes.some(n => previous.has(n.slug))) fit(nodes);
    sim.on("tick", paint);
    if (!reducedMotion.current && nodes.length) sim.alpha(.12).restart();
    return () => { sim.stop(); gesture.current = null; };
  }, [data]);
  const point = event => {
    const p = svg.current.createSVGPoint(); p.x = event.clientX; p.y = event.clientY;
    return p.matrixTransform(svg.current.getScreenCTM().inverse());
  };
  const zoomAt = (factor, p = { x: 400, y: 250 }) => {
    const old = camera.current, zoom = Math.max(.15, Math.min(4, old.zoom * factor));
    moveCamera({ zoom, x: p.x - (p.x - old.x) * zoom / old.zoom, y: p.y - (p.y - old.y) * zoom / old.zoom });
  };
  const down = event => {
    if (gesture.current || (event.button !== 0 && event.button !== 1)) return;
    event.preventDefault(); suppressClick.current = false;
    const element = event.target.closest("[data-graph-node]");
    const node = event.button === 0 && element ? model.current.nodes.find(n => n.slug === element.dataset.graphNode) : null;
    const target = node ? element : svg.current;
    target.focus({ preventScroll: true });
    gesture.current = { node, target, id: event.pointerId, start: point(event), clientX: event.clientX, clientY: event.clientY, view: { ...camera.current }, original: node ? { x: node.x, y: node.y } : null, moved: false };
    if (node) { node.fx = node.x; node.fy = node.y; setHovered(node.slug); }
    target.setPointerCapture(event.pointerId);
  };
  const move = event => {
    const g = gesture.current; if (!g || event.pointerId !== g.id) return;
    if (!g.moved && Math.hypot(event.clientX - g.clientX, event.clientY - g.clientY) < 4) return;
    const p = point(event);
    if (!g.moved) {
      g.moved = true; suppressClick.current = true; setDragging(g.node?.slug || "canvas");
      if (g.node && !reducedMotion.current) simulation.current.alphaTarget(.12).restart();
    }
    if (g.node) {
      g.node.x = g.node.fx = g.original.x + (p.x - g.start.x) / g.view.zoom;
      g.node.y = g.node.fy = g.original.y + (p.y - g.start.y) / g.view.zoom;
      paint();
    } else moveCamera({ ...g.view, x: g.view.x + p.x - g.start.x, y: g.view.y + p.y - g.start.y });
  };
  const finish = (event, cancel = false) => {
    const g = gesture.current; if (!g || (event?.pointerId !== undefined && event.pointerId !== g.id)) return;
    gesture.current = null; setDragging(null); setHovered(null);
    if (g.node) {
      if (cancel) { g.node.x = g.original.x; g.node.y = g.original.y; }
      g.node.fx = null; g.node.fy = null;
      simulation.current.alphaTarget(0);
      if (g.moved && !reducedMotion.current) simulation.current.alpha(.12).restart();
      paint();
    } else if (cancel) moveCamera(g.view);
    suppressClick.current = g.moved || cancel;
    if (g.target.hasPointerCapture(g.id)) g.target.releasePointerCapture(g.id);
  };
  useEffect(() => {
    const element = svg.current;
    const wheel = event => {
      event.preventDefault(); if (gesture.current) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1);
      zoomAt(Math.exp(-Math.max(-100, Math.min(100, delta)) * .0015), point(event));
    };
    const cancel = () => finish(null, true);
    element.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("blur", cancel);
    return () => { element.removeEventListener("wheel", wheel); window.removeEventListener("blur", cancel); };
  }, []);
  const candidate = dragging && dragging !== "canvas" ? dragging : hovered || selected;
  const active = layout.nodes.some(n => n.slug === candidate) ? candidate : null;
  const neighbors = new Set([active]);
  layout.edges.forEach(e => { if (e.source.slug === active) neighbors.add(e.target.slug); if (e.target.slug === active) neighbors.add(e.source.slug); });
  return h("div", { className: "cloud-graph" },
    h("div", { className: "cloud-toolbar" }, h("span", null, `${data.nodes.length} / ${data.total} 个条目 · 连线表示 Wiki 引用`),
      button("−", () => zoomAt(1 / 1.2), { "aria-label": "缩小图谱" }), h("output", { "aria-label": "图谱缩放比例" }, `${Math.round(view.zoom * 100)}%`),
      button("＋", () => zoomAt(1.2), { "aria-label": "放大图谱" }), button("适应全部", () => fit())),
    h("div", { className: "cloud-graph-stage" }, h("svg", { ref: svg, viewBox: "0 0 800 500", role: "group", tabIndex: 0, "aria-label": "Wiki 知识图谱", className: dragging ? "is-dragging" : "",
      onPointerDown: down, onPointerMove: move, onPointerUp: event => finish(event), onPointerCancel: event => finish(event, true),
      onLostPointerCapture: event => finish(event, true), onPointerLeave: () => { if (!gesture.current) setHovered(null); },
      onKeyDown: event => {
        if (event.key === "Escape" && gesture.current) { event.preventDefault(); finish(null, true); return; }
        if (event.target.closest("[data-graph-node]")) return;
        if (["+", "=" , "-", "0", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) event.preventDefault();
        if (["+", "="].includes(event.key)) zoomAt(1.2);
        if (event.key === "-") zoomAt(1 / 1.2);
        if (event.key === "0") fit();
        const step = event.shiftKey ? 80 : 30, v = camera.current;
        if (event.key.startsWith("Arrow")) moveCamera({ ...v, x: v.x + (event.key === "ArrowLeft" ? step : event.key === "ArrowRight" ? -step : 0), y: v.y + (event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0) });
      }
    }, h("g", { className: "cloud-graph-world", transform: `translate(${view.x} ${view.y}) scale(${view.zoom})` },
      layout.edges.map((e, i) => h("line", { key: i, x1: e.source.x, y1: e.source.y, x2: e.target.x, y2: e.target.y, className: `cloud-edge${active ? e.source.slug === active || e.target.slug === active ? " is-connected" : " is-muted" : ""}` })),
      layout.nodes.map(n => h("g", { key: n.slug, "data-graph-node": n.slug, transform: `translate(${n.x} ${n.y})`, role: "button", tabIndex: 0, "aria-label": n.title, "aria-pressed": selected === n.slug,
        className: `cloud-graph-node${n.slug === selected ? " is-active" : ""}${active && !neighbors.has(n.slug) ? " is-muted" : ""}${n.slug === active ? " is-highlighted" : ""}`,
        onPointerEnter: () => { if (!gesture.current) setHovered(n.slug); }, onPointerLeave: () => { if (!gesture.current) setHovered(null); },
        onFocus: () => setHovered(n.slug), onBlur: () => { if (!gesture.current) setHovered(null); },
        onClick: event => { if (event.detail && suppressClick.current) { suppressClick.current = false; return; } onSelect(n.slug); },
        onKeyDown: event => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); event.stopPropagation(); onSelect(n.slug); } }
      }, h("title", null, n.title), h("circle", { r: Math.max(18, n.radius + 6), className: "cloud-node-hit" }), h("circle", { r: n.radius, className: `cloud-node-dot ${n.type || ""}` }),
      h("text", { y: n.radius + 18, textAnchor: "middle" }, n.title.length > 19 && n.slug !== active ? n.title.slice(0, 18) + "…" : n.title))))),
      !data.nodes.length ? h("div", { className: "cloud-graph-empty" }, "暂无关联节点") : null),
    h("p", { className: "cloud-graph-help" }, "拖动节点整理关系 · 拖动空白平移 · 滚轮缩放 · 单击查看条目")
  );
}
