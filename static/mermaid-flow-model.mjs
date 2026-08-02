const flowHeader = /^(?:flowchart|graph)\s+(TD|TB|BT|LR|RL)$/i;
const flowLine = /^([A-Za-z0-9_-]+)(\(\[([^\]]*)\]\)|\{([^}]*)\}|\[([^\]]*)\])?\s*-->(?:\|([^|]*)\|)?\s*([A-Za-z0-9_-]+)(\(\[([^\]]*)\]\)|\{([^}]*)\}|\[([^\]]*)\])?$/;

export function createDefaultFlow() {
  return {
    direction: "TD",
    nodes: [
      { id: "start", label: "开始", shape: "round", position: { x: 180, y: 48 } },
      { id: "idea", label: "整理想法", shape: "rect", position: { x: 180, y: 164 } },
      { id: "done", label: "完成？", shape: "diamond", position: { x: 180, y: 280 } }
    ],
    edges: [
      { id: "start-idea-0", source: "start", target: "idea", label: "" },
      { id: "idea-done-1", source: "idea", target: "done", label: "" }
    ]
  };
}

export function parseMermaidFlow(code, previousGraph = createDefaultFlow()) {
  const lines = String(code || "").trim().split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const header = flowHeader.exec(lines.shift() || "");
  if (!header) return invalidFlow(previousGraph, "仅支持 Mermaid 流程图语法。");

  const nodes = new Map();
  const edges = [];
  for (const line of lines) {
    const match = flowLine.exec(line);
    if (!match) return invalidFlow(previousGraph, "Mermaid 流程图语法有误。");
    addParsedNode(nodes, match[1], match[3], match[4], match[5]);
    addParsedNode(nodes, match[7], match[9], match[10], match[11]);
    edges.push({ id: `${match[1]}-${match[7]}-${edges.length}`, source: match[1], target: match[7], label: match[6] || "" });
  }

  return { ok: true, graph: layoutFlow({ direction: normalizeDirection(header[1]), nodes: [...nodes.values()], edges }, header[1]) };
}

export function serializeMermaidFlow(graph) {
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  return [
    `flowchart ${normalizeDirection(graph.direction)}`,
    ...graph.edges.flatMap((edge) => {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      return source && target ? [`${formatNode(source)} -->${edge.label ? `|${edge.label}|` : ""} ${formatNode(target)}`] : [];
    })
  ].join("\n");
}

export function applyFlowChange(graph, change) {
  if (change.type === "rename-node") return { ...graph, nodes: graph.nodes.map((node) => node.id === change.id ? { ...node, label: change.label } : node) };
  if (change.type === "move-node") return { ...graph, nodes: graph.nodes.map((node) => node.id === change.id ? { ...node, position: { ...change.position } } : node) };
  if (change.type === "add-node") return { ...graph, nodes: [...graph.nodes, { id: change.id, label: change.label || change.id, shape: change.shape || "rect", position: change.position || { x: 120, y: 120 } }] };
  if (change.type === "delete-node") return { ...graph, nodes: graph.nodes.filter((node) => node.id !== change.id), edges: graph.edges.filter((edge) => edge.source !== change.id && edge.target !== change.id) };
  if (change.type === "add-edge") return { ...graph, edges: [...graph.edges, { id: `${change.source}-${change.target}-${graph.edges.length}`, source: change.source, target: change.target, label: change.label || "" }] };
  if (change.type === "delete-edge") return { ...graph, edges: graph.edges.filter((edge) => edge.id !== change.id) };
  if (change.type === "rename-edge") return { ...graph, edges: graph.edges.map((edge) => edge.id === change.id ? { ...edge, label: change.label } : edge) };
  return graph;
}

export function layoutFlow(graph, direction = graph.direction) {
  const normalizedDirection = normalizeDirection(direction);
  const horizontal = normalizedDirection === "LR" || normalizedDirection === "RL";
  return {
    ...graph,
    direction: normalizedDirection,
    nodes: graph.nodes.map((node, index) => ({
      ...node,
      position: horizontal ? { x: 56 + index * 220, y: 110 } : { x: 180, y: 48 + index * 132 }
    }))
  };
}

function addParsedNode(nodes, id, round, diamond, rect) {
  if (nodes.has(id)) return;
  nodes.set(id, { id, label: round || diamond || rect || id, shape: round !== undefined ? "round" : diamond !== undefined ? "diamond" : "rect", position: { x: 0, y: 0 } });
}

function formatNode(node) {
  const label = String(node.label || node.id).replace(/[\[\]{}|]/g, "");
  if (node.shape === "round") return `${node.id}([${label}])`;
  if (node.shape === "diamond") return `${node.id}{${label}}`;
  return `${node.id}[${label}]`;
}

function invalidFlow(graph, error) {
  return { ok: false, error, graph };
}

function normalizeDirection(direction) {
  const normalized = String(direction || "TD").toUpperCase();
  return normalized === "TB" ? "TD" : ["TD", "BT", "LR", "RL"].includes(normalized) ? normalized : "TD";
}
