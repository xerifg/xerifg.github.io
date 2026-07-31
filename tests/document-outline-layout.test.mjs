import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../static/app.css", import.meta.url), "utf8");
const documentPaperSource = appSource.slice(appSource.indexOf("function DocumentPaper"), appSource.indexOf("function DocumentOutline"));
const paperStyles = cssSource.match(/\.paper\s*\{[^}]*\}/)?.[0] || "";

assert.match(
  appSource,
  /const documentOutlinePanelWidth = 196;/,
  "document outline should use a stable panel width so mode switches do not change the content gap"
);

assert.doesNotMatch(
  appSource,
  /style:\s*\{\s*width:\s*`\$\{outlineWidth\}px`\s*\}/,
  "document outline should not set a per-document inline width from heading text"
);

assert.match(
  cssSource,
  /\.document-workspace\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*var\(--document-width\)\) 196px;/,
  "document workspace should place the configurable document column before the right-side outline"
);

assert.ok(
  documentPaperSource.indexOf('h("article"') < documentPaperSource.indexOf("h(DocumentOutline"),
  "document markup should render the paper before its optional outline"
);

assert.match(
  cssSource,
  /\.paper\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*var\(--document-width\);/,
  "document paper should fill the content grid column so editor/reader intrinsic size cannot change the outline gap"
);

assert.match(
  paperStyles,
  /border-radius:\s*0;[^}]*box-shadow:\s*none;/,
  "the reading surface should not be presented as a floating card"
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
  /scrollElementIntoNearestView\(activeButton\);/,
  "document outline should keep the active heading visible without scrolling the document"
);

assert.match(
  appSource,
  /scrollRoot\.scrollTo\(\{[\s\S]*top:\s*scrollRoot\.scrollTop \+ target\.top - viewport\.top - 16,[\s\S]*behavior:\s*"smooth"/,
  "document outline clicks should scroll the paper container instead of the page"
);

assert.match(
  appSource,
  /className: `document-outline-item level-\$\{item\.level\} \$\{item\.index === activeHeadingIndex \? "is-active" : ""\}`\.trim\(\)/,
  "document outline should mark the current heading for visual highlighting"
);

assert.match(
  cssSource,
  /\.document-outline\s*\{[^}]*position:\s*sticky;[^}]*border-left:\s*1px solid var\(--line\);[^}]*overflow:\s*hidden;/,
  "document outline should stay visible as a quiet right-side reading rail"
);

assert.match(
  cssSource,
  /\.document-outline ol\s*\{[\s\S]*height:\s*calc\(100% - 32px\);[\s\S]*overflow-y:\s*auto;/,
  "document outline list should be independently scrollable when headings exceed the visible panel"
);

assert.match(
  cssSource,
  /\.document-outline-item\.is-active button\s*\{[^}]*background:\s*transparent;[^}]*color:\s*#005fc7;[^}]*font-weight:\s*600;/,
  "document outline should emphasize the nearest heading without turning it into a card"
);

assert.match(
  cssSource,
  /\.document-outline-item\.is-active button::before\s*\{[\s\S]*width:\s*3px;[\s\S]*background:\s*var\(--blue\);/,
  "document outline should mark the active heading with a slim reading rail indicator"
);


assert.match(
  cssSource,
  /\.document-outline button\s*\{[\s\S]*min-height:\s*40px;[\s\S]*padding:\s*6px 9px 7px 12px;[\s\S]*line-height:\s*1\.45;/,
  "document outline buttons should give two-line headings enough vertical room"
);

assert.match(
  cssSource,
  /\.document-outline-item\.level-3 button\s*\{[\s\S]*font-size:\s*12px;[\s\S]*line-height:\s*1\.45;/,
  "level-three outline items should use the same unclipped two-line rhythm"
);

assert.match(
  appSource,
  /h\("span", \{ className: "document-outline-text" \}, item\.text\)/,
  "document outline should render heading text in a dedicated clamp span"
);

assert.match(
  cssSource,
  /\.document-outline-text\s*\{[\s\S]*display:\s*-webkit-box;[\s\S]*-webkit-line-clamp:\s*2;[\s\S]*-webkit-box-orient:\s*vertical;[\s\S]*overflow:\s*hidden;[\s\S]*text-overflow:\s*ellipsis;/,
  "document outline should clamp heading text in a nested text span"
);

assert.doesNotMatch(
  cssSource,
  /\.document-outline button\s*\{[^}]*display:\s*-webkit-box;[^}]*-webkit-line-clamp:\s*2;/,
  "document outline button should not own line clamping because it can reveal a clipped third line"
);
