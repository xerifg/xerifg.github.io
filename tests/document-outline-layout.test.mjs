import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../static/app.css", import.meta.url), "utf8");

assert.match(
  appSource,
  /const documentOutlinePanelWidth = 168;/,
  "document outline should use a stable panel width so mode switches do not change the content gap"
);

assert.doesNotMatch(
  appSource,
  /style:\s*\{\s*width:\s*`\$\{outlineWidth\}px`\s*\}/,
  "document outline should not set a per-document inline width from heading text"
);

assert.match(
  cssSource,
  /\.document-workspace\s*\{[\s\S]*grid-template-columns:\s*168px minmax\(0,\s*920px\);/,
  "document workspace should reserve the same outline column in read and edit mode"
);

assert.match(
  cssSource,
  /\.paper\s*\{[\s\S]*width:\s*100%;/,
  "document paper should fill the content grid column so editor/reader intrinsic size cannot change the outline gap"
);
