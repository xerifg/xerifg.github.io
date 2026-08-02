import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
const index = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

assert.match(app, /import mermaid from "https:\/\/esm\.sh\/mermaid@/);
assert.match(app, /const mermaidDiagramType = "mermaidDiagram"/);
assert.match(app, /mermaid\.initialize\(\{ startOnLoad: false, securityLevel: "strict" \}\)/);
assert.match(app, /const MermaidDiagram = Node\.create\(/);
assert.match(app, /name: mermaidDiagramType/);
assert.match(app, /data-mermaid-code/);
assert.match(app, /data-mermaid-graph/);
assert.match(app, /data-mermaid-positions/);
assert.match(app, /function insertMermaidDiagram\(editor\)/);
assert.match(app, /insertBlockWithEditableParagraph\(editor, \{[\s\S]*type: mermaidDiagramType/s);
const insertMenu = app.slice(app.indexOf("function FeishuInsertMenu"), app.indexOf("async function applyEditorCommand"));
assert.match(insertMenu, /label: "Mermaid 流程图", command: "mermaidDiagram"/);
assert.match(app, /if \(command === "mermaidDiagram"\) \{[\s\S]*insertMermaidDiagram\(editor\)/);
assert.match(index, /app\.js\?v=20260802-mermaid-diagrams-v1/);

console.log("mermaid editor integration contracts passed");
