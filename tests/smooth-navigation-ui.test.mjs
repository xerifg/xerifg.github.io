import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../static/app.css", import.meta.url), "utf8");

assert.match(app, /const \[isDocumentSwitching, setIsDocumentSwitching\] = useState\(false\)/);
assert.match(app, /className: `content \$\{isDocumentSwitching \? "is-document-switching" : ""\}`/);
assert.match(app, /is-dragging/);
assert.match(css, /\.tree-folder-children\s*\{[\s\S]*transition:/);
assert.match(css, /\.tree-note\.is-dragging\s*\{[\s\S]*transform:/);
assert.match(css, /\.tree-note\.drop-before::before[\s\S]*animation:/);
assert.match(css, /\.content\.is-document-switching \.document-workspace\s*\{[\s\S]*animation:/);
