import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../static/app.css", import.meta.url), "utf8");
const desktopPolish = css.slice(css.indexOf("/* Desktop document reading and editing polish. */"));

function ruleBodies(selector) {
  const bodies = [];
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1].split(",").map((value) => value.trim());
    if (selectors.includes(selector)) bodies.push(match[2]);
  }
  assert.ok(bodies.length, `expected a CSS rule for ${selector}`);
  return bodies.join("\n");
}

assert.doesNotMatch(app, /documentOutlinePanelWidth/, "the outline width should be owned by proportional CSS, not a fixed JavaScript value");
assert.match(css, /\.app-shell\s*\{[^}]*grid-template-columns:\s*56px 14% minmax\(0, 1fr\);/s, "the desktop shell should keep its icon rail stable while the directory scales proportionally");
const workspace = ruleBodies(".document-workspace");
assert.match(workspace, /width:\s*100%/, "the desktop workspace should span the content viewport");
assert.match(
  workspace,
  /grid-template-columns:\s*minmax\(0,\s*1fr\) 12vw/,
  "medium desktop should reserve a proportional outline rail"
);
assert.match(workspace, /gap:\s*24px/, "the desktop paper and outline should keep a 24px separation");
assert.match(workspace, /justify-content:\s*stretch/, "the desktop grid should fill the available width");
assert.match(
  desktopPolish,
  /\.paper\s*\{[^}]*justify-self:\s*center/s,
  "the paper should center independently from the outline"
);
assert.match(
  desktopPolish,
  /\.document-outline\s*\{[^}]*width:\s*12vw[^}]*justify-self:\s*end[^}]*height:\s*calc\(100vh - 64px\)[^}]*max-height:\s*none/s,
  "the outline should align to the far right and span the viewport below the top bar"
);
assert.match(
  desktopPolish,
  /@media \(min-width:\s*1101px\)[\s\S]*\.document-outline\s*\{[^}]*position:\s*fixed[^}]*top:\s*64px[^}]*right:\s*0[^}]*overflow:\s*hidden/s,
  "desktop outline should stay fixed to the viewport while the document scrolls"
);
assert.match(
  desktopPolish,
  /@media \(min-width:\s*1101px\)[\s\S]*\.document-outline ol\s*\{[^}]*display:\s*block[^}]*overflow-x:\s*hidden[^}]*overflow-y:\s*auto/s,
  "medium desktop should keep an independently vertically scrolling outline list"
);
assert.match(
  desktopPolish,
  /@media \(max-width:\s*1100px\)[\s\S]*\.document-outline\s*\{[^}]*display:\s*none/s,
  "the outline should be hidden at and below the compact breakpoint"
);
assert.doesNotMatch(
  desktopPolish,
  /\.document-outline-item\.is-active button\s*\{[^}]*background:\s*var\(--surface-selected\)/s,
  "layout polish should preserve the existing transparent active outline row"
);
assert.match(
  desktopPolish,
  /\.document-workspace\.without-outline,\s*\.document-workspace\.has-empty-outline\s*\{[^}]*grid-template-columns:\s*1fr/s,
  "outline-free documents should use one centered column"
);
assert.match(
  desktopPolish,
  /\.document-workspace\.has-empty-outline \.document-outline\s*\{[^}]*display:\s*none/s,
  "an empty outline should not reserve a blank rail"
);
assert.doesNotMatch(
  desktopPolish,
  /@media \(min-width:\s*1600px\)[\s\S]*\.document-workspace\.has-outline/,
  "wide desktop should not overlay the outline over the reading canvas"
);
assert.match(
  desktopPolish,
  /@media \(min-width:\s*1101px\)[\s\S]*\.document-workspace\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) 12vw/,
  "the document-width percentage should resolve inside the canvas remaining after the outline rail"
);

assert.match(
  ruleBodies(".document-topbar"),
  /min-height:\s*64px/,
  "the document top bar should use the confirmed 64px desktop rhythm"
);

assert.match(
  ruleBodies(".paper-scroll"),
  /padding:\s*0 0 52px/,
  "desktop reading content should begin immediately below the 64px top bar"
);
assert.match(
  ruleBodies(".paper"),
  /padding:\s*44px 8px 72px/,
  "the paper should keep a 44px title inset without doubling the canvas gutter"
);

for (const selector of [".doc-title", ".doc-title-input"]) {
  const title = ruleBodies(selector);
  assert.match(title, /font-size:\s*36px/, `${selector} should use the confirmed 36px title size`);
  assert.match(title, /line-height:\s*1\.2/, `${selector} should use a calm 1.2 title line height`);
  assert.match(title, /letter-spacing:\s*-\.?\d+em/, `${selector} should use a subtle negative title tracking`);
}

assert.match(
  app,
  /h\("div",\s*\{\s*className:\s*"document-outline-title"\s*\},\s*"\\u5927\\u7eb2"\)/,
  "the right rail should retain the concise outline title"
);
assert.match(
  ruleBodies(".document-outline"),
  /width:\s*12vw/,
  "the visual outline rail should occupy a proportional desktop column"
);

const treeRows = ruleBodies(".tree-folder") + "\n" + ruleBodies(".tree-note");
assert.match(treeRows, /min-height:\s*40px/, "comfortable notebook tree rows should remain 40px tall");
const activeNote = ruleBodies(".tree-note.active");
assert.match(activeNote, /background:\s*var\(--surface-selected\)/, "the active note should retain the selected surface");
assert.match(activeNote, /box-shadow:[^;}]*inset 3px 0 var\(--blue\)/, "the active note should retain its left selection rail");

for (const selector of [
  ".feishu-editor pre.notebook-code-block",
  ".tiptap-reader pre.notebook-code-block"
]) {
  const codeBlock = ruleBodies(selector);
  assert.match(codeBlock, /border:\s*1px solid var\(--line\)/, `${selector} should use a neutral default border`);
  assert.doesNotMatch(codeBlock, /border(?:-color)?:[^;}]*var\(--blue\)/, `${selector} should not be blue before focus`);
}

assert.match(
  ruleBodies(".feishu-editor pre.notebook-code-block:focus-within"),
  /border-color:\s*var\(--blue\)/,
  "only the focused editable code block should receive the blue border"
);

const sanitizedReaderCodeBlock = ruleBodies(".tiptap-reader pre");
assert.match(
  sanitizedReaderCodeBlock,
  /border:\s*1px solid var\(--line\)/,
  "sanitized reading-mode pre elements should keep the same neutral default border"
);
assert.doesNotMatch(
  sanitizedReaderCodeBlock,
  /border(?:-color)?:[^;}]*var\(--blue\)/,
  "ordinary reading-mode pre elements should never appear focused"
);

assert.match(
  ruleBodies(".feishu-editor pre:focus-within"),
  /border-color:\s*var\(--blue\)/,
  "an ordinary editable pre should receive the blue border only while focused"
);

for (const selector of [".feishu-editor code", ".tiptap-reader code"]) {
  const inlineCode = ruleBodies(selector);
  assert.match(inlineCode, /border:\s*1px solid #dee0e3/, `${selector} should use a Feishu-like subtle outline`);
  assert.match(inlineCode, /background:\s*#f2f3f5/, `${selector} should use the Feishu inline code chip surface`);
  assert.match(inlineCode, /border-radius:\s*4px/, `${selector} should keep the compact inline code radius`);
  assert.match(inlineCode, /font-size:\s*\.875em/, `${selector} should sit slightly smaller than body text`);
}

const bubbleButton = ruleBodies(".feishu-bubble-button");
assert.match(bubbleButton, /width:\s*32px/, "selected-text toolbar buttons should have aligned Feishu-like icon cells");
assert.match(bubbleButton, /height:\s*32px/, "selected-text toolbar buttons should keep one consistent height");
assert.match(bubbleButton, /display:\s*inline-flex/, "selected-text toolbar buttons should align icons and text on one axis");
assert.match(ruleBodies(".feishu-style-trigger"), /width:\s*48px/, "the block style trigger should reserve space for text and chevron");
assert.match(ruleBodies(".feishu-style-panel"), /width:\s*232px/, "the block style menu should match the compact Feishu dropdown width");
assert.match(ruleBodies(".feishu-style-panel button"), /grid-template-columns:\s*28px minmax\(0,\s*1fr\) 18px/, "style menu rows should align icon, label, and check columns");

assert.match(
  app,
  /enhanceReaderCodeBlocks\(readerRef\.current\)/,
  "reading mode should enhance code blocks after sanitized HTML is mounted"
);
assert.match(
  app,
  /function createEnhancedCodeBlockElement\(/,
  "reader and editor code blocks should share the same enhanced block structure"
);
assert.match(
  app,
  /getCodeText:\s*\(\)\s*=>\s*currentNode\.textContent/,
  "editable code block line numbers should use the ProseMirror node text instead of editable DOM text"
);
assert.match(
  app,
  /const codeText = \(\) => options\.getCodeText\?\.\(\) \?\? contentDOM\.textContent \?\? ""/,
  "shared code block controls should fall back to DOM text for reading mode"
);
assert.match(
  app,
  /collapseButton\.addEventListener\("click"/,
  "the code block disclosure control should toggle collapse state"
);
assert.doesNotMatch(
  app,
  /actions\.append\(language,\s*separatorNode\(\),\s*wrapButton,\s*separatorNode\(\),\s*copyButton\)/,
  "inactive language and wrap controls should not remain in the code block header"
);
assert.doesNotMatch(
  app,
  /function separatorNode\(\)/,
  "unused code block separators should be removed with the inactive controls"
);
assert.match(
  ruleBodies(".notebook-code-toolbar"),
  /opacity:\s*0/,
  "code block controls should be hidden until hover or keyboard focus"
);
assert.match(
  ruleBodies("pre.notebook-code-block:hover .notebook-code-toolbar"),
  /opacity:\s*1/,
  "code block controls should appear on hover"
);
assert.match(
  ruleBodies("pre.notebook-code-block:focus-within .notebook-code-toolbar"),
  /opacity:\s*1/,
  "code block controls should remain accessible during keyboard focus"
);
assert.match(
  ruleBodies(".notebook-code-gutter span"),
  /display:\s*block/,
  "enhanced code blocks should render persistent line number rows"
);
assert.match(
  ruleBodies("pre.notebook-code-block.is-collapsed .notebook-code-body"),
  /display:\s*none/,
  "collapsed code blocks should hide the full code body"
);

for (const selector of [".feishu-editor pre code", ".tiptap-reader pre code"]) {
  const ordinaryCode = ruleBodies(selector);
  assert.match(ordinaryCode, /min-width:\s*0/, `${selector} should be allowed to shrink within the paper`);
  assert.match(ordinaryCode, /white-space:\s*pre-wrap/, `${selector} should wrap sanitized code without horizontal overflow`);
}
