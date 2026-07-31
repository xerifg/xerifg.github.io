import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
const ui = readFileSync(new URL("../static/library-ui.mjs", import.meta.url), "utf8");
const reactUrl = "https://esm.sh/react@18.3.1";

const importMapMatch = index.match(/<script\s+type="importmap">\s*([\s\S]*?)\s*<\/script>/);
assert.ok(importMapMatch, "the module entrypoint must provide an import map for externalized browser dependencies");

const importMap = JSON.parse(importMapMatch[1]);
assert.equal(importMap.imports?.react, reactUrl, "the bare react dependency must resolve to the pinned React module");

const appModuleScriptIndex = index.indexOf('<script type="module"');
assert.ok(importMapMatch.index < appModuleScriptIndex, "the import map must be declared before the application module loads");

const lucideImport = `https://esm.sh/lucide-react@0.468.0?external=react`;
assert.match(app, new RegExp(`from "${lucideImport.replace(/[.?]/g, "\\$&")}"`));
assert.match(ui, new RegExp(`from "${lucideImport.replace(/[.?]/g, "\\$&")}"`));
