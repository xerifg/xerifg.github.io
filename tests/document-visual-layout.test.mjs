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

assert.match(
  app,
  /const documentOutlinePanelWidth = 210;/,
  "the inline outline width should match the 210px desktop rail"
);
const workspace = ruleBodies(".document-workspace");
assert.match(workspace, /width:\s*100%/, "the desktop workspace should span the content viewport");
assert.match(
  workspace,
  /grid-template-columns:\s*minmax\(0,\s*1fr\) 210px/,
  "medium desktop should reserve a flexible paper column beside the 210px outline"
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
  /\.document-outline\s*\{[^}]*width:\s*210px[^}]*justify-self:\s*end[^}]*height:\s*calc\(100vh - 64px\)[^}]*max-height:\s*none/s,
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
assert.match(
  desktopPolish,
  /@media \(min-width:\s*1600px\)[\s\S]*\.document-workspace\.has-outline\s*\{[^}]*grid-template-columns:\s*1fr[^}]*\}[\s\S]*grid-column:\s*1[^}]*grid-row:\s*1/,
  "wide desktop should center the paper in the full area while overlaying the end-aligned outline"
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
  /width:\s*210px/,
  "the visual outline rail should explicitly occupy the stable 210px column"
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

for (const selector of [".feishu-editor pre code", ".tiptap-reader pre code"]) {
  const ordinaryCode = ruleBodies(selector);
  assert.match(ordinaryCode, /min-width:\s*0/, `${selector} should be allowed to shrink within the paper`);
  assert.match(ordinaryCode, /white-space:\s*pre-wrap/, `${selector} should wrap sanitized code without horizontal overflow`);
}