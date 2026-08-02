import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../static/app.css", import.meta.url), "utf8");

assert.match(app, /function MermaidDiagramView\(/);
assert.match(app, /function MermaidFlowCanvas\(/);
assert.match(app, /onNodesChange/);
assert.match(app, /onConnect/);
assert.match(app, /onNodeDoubleClick/);
assert.match(app, /onEdgesDelete/);
assert.match(app, /parseMermaidFlow\(code, graph\)/);
assert.match(app, /await mermaid\.render\(/);
assert.match(css, /\.mermaid-flow-canvas\s*\{[\s\S]*min-height: 420px/s);
assert.match(css, /\.mermaid-source-panel/);

console.log("mermaid canvas UI contracts passed");
