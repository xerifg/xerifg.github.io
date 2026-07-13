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
  /\.document-workspace\s*\{[\s\S]*grid-template-columns:\s*168px minmax\(0,\s*1120px\);/,
  "document workspace should reserve the same outline column in read and edit mode"
);

assert.match(
  cssSource,
  /\.paper\s*\{[\s\S]*max-width:\s*1120px;/,
  "document paper should use the wider content column"
);

assert.match(
  cssSource,
  /\.paper\s*\{[\s\S]*width:\s*100%;/,
  "document paper should fill the content grid column so editor/reader intrinsic size cannot change the outline gap"
);

assert.match(
  appSource,
  /const \[activeHeadingIndex,\s*setActiveHeadingIndex\] = useState\(outline\[0\]\?\.index \?\? -1\);/,
  "document outline should track which heading is active in the current reading viewport"
);

assert.match(
  appSource,
  /scrollRoot\.addEventListener\("scroll", updateActiveHeading, \{ passive: true \}\);/,
  "document outline should update the active heading as the document scrolls"
);

assert.match(
  appSource,
  /activeButton\.scrollIntoView\(\{ block: "nearest", inline: "nearest" \}\);/,
  "document outline should scroll itself to keep the active heading visible"
);

assert.match(
  appSource,
  /className: `document-outline-item level-\$\{item\.level\} \$\{item\.index === activeHeadingIndex \? "is-active" : ""\}`\.trim\(\)/,
  "document outline should mark the current heading for visual highlighting"
);

assert.match(
  cssSource,
  /\.document-outline\s*\{[\s\S]*position:\s*sticky;[\s\S]*top:\s*16px;[\s\S]*height:\s*min\(calc\(100vh - 128px\),\s*720px\);[\s\S]*overflow:\s*hidden;/,
  "document outline should stay visible as a tall reading rail"
);

assert.match(
  cssSource,
  /\.document-outline ol\s*\{[\s\S]*height:\s*calc\(100% - 32px\);[\s\S]*overflow-y:\s*auto;/,
  "document outline list should be independently scrollable when headings exceed the visible panel"
);

assert.match(
  cssSource,
  /\.document-outline-item\.is-active button\s*\{[\s\S]*background:\s*rgba\(0,\s*122,\s*255,\s*\.12\);/,
  "document outline should visibly highlight the heading nearest the document center"
);

assert.match(
  cssSource,
  /\.document-outline-item\.is-active button::before\s*\{[\s\S]*width:\s*3px;[\s\S]*background:\s*var\(--blue\);/,
  "document outline should mark the active heading with a slim reading rail indicator"
);
