import assert from "node:assert/strict";
import { buildTagLinks, layoutNetworkNodes } from "../static/network-model.mjs";

const notes = [
  { tags: ["知识库", "Tiptap", "GitHub"] },
  { tags: ["知识库", "Tiptap"] },
  { tags: ["阅读", "知识库"] },
  { tags: ["GitHub"] }
];

const links = buildTagLinks(notes, ["知识库", "Tiptap", "GitHub", "阅读"]);

assert.deepEqual(
  links.map((link) => `${link.source}->${link.target}:${link.weight}`),
  ["知识库->Tiptap:2", "知识库->GitHub:1", "知识库->阅读:1", "Tiptap->GitHub:1"]
);

const nodes = layoutNetworkNodes(
  [
    { name: "知识库", count: 3 },
    { name: "Tiptap", count: 2 },
    { name: "GitHub", count: 2 },
    { name: "阅读", count: 1 }
  ],
  1200,
  800
);

assert.equal(nodes.length, 4);
assert.equal(nodes[0].name, "知识库");
assert.ok(nodes.every((node) => node.x > 0 && node.y > 0));
assert.deepEqual(nodes, layoutNetworkNodes(nodes, 1200, 800));
