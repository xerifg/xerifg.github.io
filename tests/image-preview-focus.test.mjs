import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const app = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
assert.match(app, /const imagePreviewTriggerRef = useRef\(null\)/);
assert.match(app, /imagePreviewTriggerRef\.current = image/);
assert.match(app, /imagePreviewTriggerRef\.current\?\.isConnected && imagePreviewTriggerRef\.current\.focus\(\)/);
