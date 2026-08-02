import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../static/app.css", import.meta.url), "utf8");

assert.match(app, /function MermaidDiagramView\(/);
assert.doesNotMatch(app, /function MermaidFlowCanvas\(|onNodesChange|onConnect|onNodeDoubleClick|onEdgesDelete|parseMermaidFlow/);
assert.match(app, /await mermaid\.render\(/);
assert.doesNotMatch(css, /\.mermaid-flow-canvas|\.mermaid-flow-node|\.mermaid-flow-handle/);
assert.match(css, /\.mermaid-source-panel/);

console.log("mermaid canvas UI contracts passed");
