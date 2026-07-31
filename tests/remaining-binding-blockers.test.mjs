import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../static/app.css", import.meta.url), "utf8");

function ruleBodies(selector) {
  const bodies = [];
  const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of cssWithoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1].split(",").map((value) => value.trim());
    if (selectors.includes(selector)) bodies.push(match[2]);
  }
  assert.ok(bodies.length, `expected a production CSS rule for ${selector}`);
  return bodies.join("\n");
}

const tokenContracts = [
  [".rail-item.is-active", /background:\s*var\(--surface-selected\)/, /color:\s*var\(--blue-dark\)/],
  [".tree-note.active", /background:\s*var\(--surface-selected\)/, /color:\s*var\(--blue-dark\)/, /box-shadow:[^;}]*var\(--blue\)/],
  [".document-outline", /color:\s*var\(--muted\)/],
  [".document-outline-title", /color:\s*var\(--muted\)/],
  [".document-outline-item.level-1 button", /color:\s*var\(--text\)/],
  [".document-outline-item.level-3 button", /color:\s*var\(--muted\)/],
  [".document-outline button:hover", /background:\s*var\(--surface-hover\)/, /color:\s*var\(--blue-dark\)/],
  [".table-column-handle button", /background:\s*var\(--surface-raised\)/, /color:\s*var\(--text\)/, /border-color:\s*var\(--line\)/],
  [".table-cell-toolbar", /background:\s*var\(--surface-raised\)/, /border-color:\s*var\(--line\)/],
  [".table-action-menu", /background:\s*var\(--surface-raised\)/, /border-color:\s*var\(--line\)/],
  [".table-action-menu button", /color:\s*var\(--text\)/],
  [".table-insert-grid", /background:\s*var\(--surface-raised\)/, /border-color:\s*var\(--line\)/],
  [".table-selection-toolbar", /background:\s*var\(--surface-raised\)/, /border-color:\s*var\(--line\)/],
  [".table-selection-toolbar button", /color:\s*var\(--text\)/],
  [".table-toolbar-popover", /background:\s*var\(--surface-raised\)/, /border-color:\s*var\(--line\)/],
  [".feishu-plus", /background:\s*var\(--surface-raised\)/, /color:\s*var\(--text\)/, /border-color:\s*var\(--line\)/],
  [".feishu-insert-menu", /background:\s*var\(--sheet\)/, /color:\s*var\(--text\)/, /border-color:\s*var\(--line\)/],
  [".feishu-menu-section button", /color:\s*var\(--text\)/],
  [".feishu-bubble button", /color:\s*var\(--text\)/],
  [".feishu-color-panel", /background:\s*var\(--surface-raised\)/, /color:\s*var\(--text\)/, /border-color:\s*var\(--line\)/],
  [".feishu-color-title", /color:\s*var\(--muted\)/],
  [".feishu-color-reset", /background:\s*var\(--surface-control\)/, /color:\s*var\(--text\)/]
];

for (const [selector, ...contracts] of tokenContracts) {
  const body = ruleBodies(selector).replace(/border:\s*1px solid var\(--line\)/g, "border-color: var(--line)");
  for (const contract of contracts) assert.match(body, contract, `${selector} must use its theme token contract`);
}

assert.doesNotMatch(css, /\.rail-item\.is-active\s*\{[^}]*#e3ebf7/);
assert.doesNotMatch(css, /\.tree-note\.active\s*\{[^}]*#dfeafb/);
assert.doesNotMatch(css, /\.document-outline-item\.level-1 button\s*\{[^}]*#303236/);

const deleteDraftsBranch = app.slice(
  app.indexOf('if (state.modal === "delete-drafts")'),
  app.indexOf('if (state.modal === "publish-review")')
);
assert.match(deleteDraftsBranch, /return modalShell\(/, "delete-drafts must share the accessible modal lifecycle");
assert.match(deleteDraftsBranch, /"confirm-delete-drafts"/);
assert.match(deleteDraftsBranch, /confirmClassName:\s*"danger-btn"/);
assert.doesNotMatch(deleteDraftsBranch, /h\("div",\s*\{\s*className:\s*"modal(?:-backdrop)?"/);

const modalShellSource = app.slice(
  app.indexOf("function ModalShell"),
  app.indexOf("async function loadPublishedLibrary")
);
assert.match(modalShellSource, /role:\s*"dialog"/);
assert.match(modalShellSource, /"aria-modal":\s*"true"/);
assert.match(modalShellSource, /event\.key === "Escape"/);
assert.match(modalShellSource, /event\.key !== "Tab"/);
assert.match(modalShellSource, /previousFocus\?\.isConnected/);
assert.match(modalShellSource, /previousFocus\.focus\(\)/);
assert.match(modalShellSource, /document\.addEventListener\("keydown", onKeyDown\)/);
assert.match(modalShellSource, /document\.removeEventListener\("keydown", onKeyDown\)/);
