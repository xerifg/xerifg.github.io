import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");

assert.ok(
  appSource.includes("markdownTextLooksStructured(text)"),
  "plain-text Markdown paste should be detected before falling back to default paste"
);

assert.ok(
  appSource.includes("const heading = trimmed.match(/^(#{1,3})\\s+(.+)$/);"),
  "Markdown paste should convert heading markers into heading nodes"
);

assert.ok(
  appSource.includes("parseMarkdownList(lines, index)"),
  "Markdown paste should preserve bullet and numbered list structure"
);

assert.ok(
  appSource.includes("<code>$1</code>"),
  "Markdown paste should convert inline code markers"
);

assert.ok(
  appSource.includes("<strong>$1</strong>"),
  "Markdown paste should convert bold markers"
);


assert.ok(
  appSource.includes('const html = event.clipboardData?.getData("text/html") || "";')
    && appSource.includes('if (html.trim()) return false;'),
  "rich HTML clipboard data should use the editor default paste path instead of plain-text Markdown parsing"
);

assert.ok(
  appSource.includes('transformPastedHTML(html)')
    && appSource.includes('return sanitizeHtml(restoreMarkdownMathInHtml(html));'),
  "rich HTML paste should preserve structure while restoring Markdown math nodes"
);
