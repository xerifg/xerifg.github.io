import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";
import { assertPublishableHtml } from "../static/publish-model.mjs";
import { repairLegacyAssetReferences } from "../static/legacy-asset-repair.mjs";

// These two replacements are evidenced by the last valid BevFusion revision 89f29c4.
const first = "blob:https://xerifg.github.io/93d18d2d-fc4d-401c-9dea-ca13193087cc";
const second = "blob:https://xerifg.github.io/e3863ea2-0330-4c4d-a88d-cf92095ea709";
const html = `<img src="${first}"><p>正文</p><img src="${second}"><a href="blob:new-html">新附件</a>`;
const note = { id: "note-1787192363486", title: "BevFusion", html, dirty: true, assets: [{ id: "new", localUrl: "blob:new-html", storage: "indexeddb", assetId: "new" }] };
const repaired = repairLegacyAssetReferences(note);
assert.ok(!repaired.html.includes(first) && !repaired.html.includes(second));
assert.ok(repaired.html.includes("blob:new-html"), "new local HTML attachments must retain their cache references");
assert.equal(repaired.assets.length, 3);
assert.equal(repaired.assets[0].assetId, "new");
for (const asset of repaired.assets.slice(1)) {
  assert.ok(existsSync(new URL(`../${asset.remotePath}`, import.meta.url)));
  assert.ok(repaired.html.includes(asset.remotePath));
  assert.equal(asset.published, true);
}
assert.deepEqual(repairLegacyAssetReferences(repaired), repaired, "repair must be idempotent");
assert.equal(note.html, html, "do not mutate the source draft");
assert.equal(repairLegacyAssetReferences({ ...note, id: "other" }).html, html, "never guess replacements for other notes");
const source = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
const context = vm.createContext({});
for (const [start, end] of [["function replaceLocalAssetUrls(", "async function getGitHubSha("], ["function assetReferenceUrls(", "function sanitizeHtml("]]) {
  vm.runInContext(source.slice(source.indexOf(start), source.indexOf(end)), context);
}
context.note = repaired;
context.assets = repaired.assets.map(asset => asset.id === "new" ? { ...asset, remotePath: "notebooks/assets/new.html" } : asset);
const publishedHtml = vm.runInContext("replaceLocalAssetUrls(note.html, assets)", context);
assertPublishableHtml(publishedHtml, repaired.title);
assert.ok(publishedHtml.includes('href="notebooks/assets/new.html"'), "HTML attachment and repaired images must all publish with durable paths");
const published = JSON.parse(readFileSync(new URL("../notebooks/docs/bevfusion模型.json", import.meta.url), "utf8"));
assert.ok(!published.html.includes("blob:"), "the published BevFusion document must reference durable images");
console.log("Legacy asset repair: exact historical images restored; new attachments and unrelated notes preserved");
