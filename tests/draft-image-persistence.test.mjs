import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");

assert.match(
  appSource,
  /item\.html = normalizeDraftHtml\(nextHtml, item\.html, item\.assets\);/,
  "draft editor updates should preserve newly inserted image nodes from stale editor snapshots"
);

assert.match(
  appSource,
  /function normalizeDraftHtml\(nextHtml, currentHtml, assets = \[\]\)/,
  "draft HTML normalization should have an asset-aware path"
);

assert.match(
  appSource,
  /Date\.now\(\) - createdAt < 5000/,
  "recently inserted assets should be protected only during the short insertion/save race window"
);

assert.match(
  appSource,
  /createdAt: Date\.now\(\),\s*cached,/,
  "newly cached notebook assets should carry insertion time for draft preservation"
);

assert.match(
  appSource,
  /setToast\("本地草稿保存失败，请减少图片大小后重试"\);/,
  "localStorage quota failures should be visible instead of silently losing draft images on refresh"
);
assert.match(
  appSource,
  /function sanitizePublishedAssets\(assets, html\)/,
  "published document loading should sanitize asset metadata before storing browser drafts"
);

assert.match(
  appSource,
  /assets: sanitizePublishedAssets\(documentData\.assets \|\| \[\], documentHtml\)/,
  "published documents should not persist data URLs or unreferenced asset records into localStorage"
);

assert.match(
  appSource,
  /return \[\.\.\.published, \.\.\.preserved\];/,
  "publishing should write back only assets still referenced by the document body"
);
assert.match(
  appSource,
  /assets: noteDirty \? noteAssets : sanitizePublishedAssets\(noteAssets, noteHtml\)/,
  "migration should clean stale published asset data already stored in localStorage"
);
