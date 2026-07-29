import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../static/app.css", import.meta.url), "utf8");
const indexSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");

assert.match(
  appSource,
  /buildPublishChangeDetails/,
  "publish review should use model-provided change details"
);

assert.match(
  appSource,
  /className: "publish-change-details"/,
  "publish review rows should render an expandable details section"
);

assert.match(
  appSource,
  /查看差异/,
  "publish review rows should expose a visible diff trigger"
);

assert.match(
  appSource,
  /远端/,
  "publish diff details should label the remote value"
);

assert.match(
  appSource,
  /本地待发表/,
  "publish diff details should label the local value that will be published"
);

assert.match(
  cssSource,
  /\.publish-change-details/,
  "publish diff details should have dedicated styles"
);
assert.match(
  indexSource,
  /app\.js\?v=20260729-publish-diff-v3/,
  "the page should request the publish diff script instead of a cached script"
);

assert.match(
  indexSource,
  /app\.css\?v=20260729-publish-diff-v3/,
  "the page should request the publish diff styles instead of cached styles"
);
assert.match(
  appSource,
  /loadPublishedDocumentFallback/,
  "publish review should fall back to the already published local document JSON when GitHub document details are unavailable"
);
assert.match(
  appSource,
  /from "\.\/publish-model\.mjs\?v=20260729-publish-diff-v2"/,
  "the app should version the publish model import so Chrome does not reuse a stale cached module"
);