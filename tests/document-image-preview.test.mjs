import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../static/app.css", import.meta.url), "utf8");

assert.match(
  appSource,
  /function DocumentImagePreview\(\{ preview, onClose \}\)/,
  "document image preview should render through a focused overlay component"
);

assert.match(
  appSource,
  /const openImagePreview = useCallback\(\(event\) =>/,
  "DocumentPaper should own a shared image preview click handler"
);

assert.match(
  appSource,
  /className: "reader tiptap-reader",[\s\S]*?onClick: openImagePreview/,
  "reading mode should open the image preview when reader images are clicked"
);

assert.match(
  appSource,
  /onImagePreview: openImagePreview/,
  "editing mode should pass the shared image preview handler into TiptapEditor"
);

assert.match(
  appSource,
  /handleClick\(view, position, event\)[\s\S]*?onImagePreview\?\.\(event\)/,
  "TiptapEditor should intercept image clicks for preview without mutating document content"
);

assert.match(
  appSource,
  /document\.addEventListener\("keydown", handleKeyDown\)/,
  "image preview should close on Escape through a document keydown listener"
);

assert.match(
  cssSource,
  /\.image-preview-backdrop/,
  "image preview overlay should have backdrop styles"
);

assert.match(
  cssSource,
  /--preview-origin-x/,
  "image preview animation should use source image geometry variables"
);
