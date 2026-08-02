import assert from "node:assert/strict";
import {
  applyFlowChange,
  createDefaultFlow,
  layoutFlow,
  parseMermaidFlow,
  serializeMermaidFlow
} from "../static/mermaid-flow-model.mjs";

const initial = createDefaultFlow();
assert.equal(initial.direction, "TD");
assert.equal(initial.nodes.length, 3);
assert.match(serializeMermaidFlow(initial), /^flowchart TD/m);

const parsed = parseMermaidFlow("flowchart LR\nstart([开始]) -->|整理| idea[整理想法]\nidea --> done{完成？}", initial);
assert.equal(parsed.ok, true);
assert.equal(parsed.graph.direction, "LR");
assert.deepEqual(parsed.graph.nodes.map((node) => [node.id, node.shape, node.label]), [
  ["start", "round", "开始"],
  ["idea", "rect", "整理想法"],
  ["done", "diamond", "完成？"]
]);
assert.equal(parsed.graph.edges[0].label, "整理");

const renamed = applyFlowChange(initial, { type: "rename-node", id: "start", label: "创建文档" });
assert.match(serializeMermaidFlow(renamed), /创建文档/);

const moved = applyFlowChange(initial, { type: "move-node", id: "idea", position: { x: 240, y: 180 } });
assert.deepEqual(moved.nodes.find((node) => node.id === "idea")?.position, { x: 240, y: 180 });

const withEdge = applyFlowChange(initial, { type: "add-edge", source: "done", target: "start", label: "继续" });
assert.equal(withEdge.edges.at(-1)?.label, "继续");
assert.equal(applyFlowChange(initial, { type: "delete-node", id: "idea" }).edges.length, 0);

const invalid = parseMermaidFlow("sequenceDiagram\nA->>B: hi", initial);
assert.equal(invalid.ok, false);
assert.deepEqual(invalid.graph, initial);
assert.match(invalid.error, /流程图/);

const horizontal = layoutFlow(initial, "LR");
assert.ok(horizontal.nodes[1].position.x > horizontal.nodes[0].position.x);

console.log("mermaid flow model tests passed");
