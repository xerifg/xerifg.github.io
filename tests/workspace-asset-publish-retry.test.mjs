import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { blobToBase64 } from "../static/draft-asset-store.mjs";

const source = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
const blob = new Blob(["<h1>HTML attachment</h1>"], { type: "text/html" });
const cache = new Map([["html", blob]]);
const uploads = [];
let failUpload = false;
const context = vm.createContext({
  normalizeHtml: value => value,
  assetReferenceUrls: asset => [asset.localUrl, asset.remotePath].filter(Boolean),
  draftAssetStore: { get: async id => cache.get(id), remove: async id => cache.delete(id) },
  blobToBase64FromDraftAsset: blobToBase64,
  putGitHubBase64File: async (...args) => { if (failUpload) throw Error("Failed to fetch"); uploads.push(args); },
  console
});
vm.runInContext(source.slice(source.indexOf("async function publishPendingAssets("), source.indexOf("function replaceLocalAssetUrls(")), context);
const note = { html: '<a href="blob:html">HTML</a>', assets: [{ id: "html", assetId: "html", storage: "indexeddb", localUrl: "blob:html", remotePath: "notebooks/assets/html.html" }] };
context.note = note;
await vm.runInContext("publishPendingAssets({}, note)", context);
// Uploading the attachment is only the first step: document/index commits can still fail.
assert.ok(cache.has("html"), "attachment upload must retain bytes until the document and index are committed");
failUpload = true;
await assert.rejects(vm.runInContext("publishPendingAssets({}, note)", context), /Failed to fetch/);
assert.ok(cache.has("html"), "network failures must not destroy the retry payload");
failUpload = false;
await vm.runInContext("publishPendingAssets({}, note)", context);
assert.equal(uploads.length, 2);
assert.equal(uploads[1][2], await blobToBase64(blob));
assert.equal(await cache.get("html").text(), "<h1>HTML attachment</h1>");
console.log("Attachment publish retry: local bytes retained across partial publication and network failures");
