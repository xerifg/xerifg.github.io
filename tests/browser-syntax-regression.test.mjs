import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
const lucideImportSource = app.match(/import \{[\s\S]*?\} from "https:\/\/esm\.sh\/lucide-react@0\.468\.0\?external=react";/)?.[0] || "";
const deleteDraftsBranch = app.slice(
  app.indexOf('if (state.modal === "delete-drafts")'),
  app.indexOf('if (state.modal === "publish-review")')
);

assert.match(lucideImportSource, /Video as VideoIcon/, "the lucide video icon must be aliased away from the editor Video node");
assert.doesNotMatch(lucideImportSource, /,\s*Video\s*[,}]/, "the lucide import must not redeclare the editor Video node binding");

assert.match(
  deleteDraftsBranch,
  /summary\.deletedTags\.length[\s\S]*?: null\s*\),\s*"\u786e\u8ba4\u5220\u9664\u8349\u7a3f"/,
  "delete-drafts must pass the summary body and confirm label as adjacent modalShell arguments"
);
assert.doesNotMatch(
  deleteDraftsBranch,
  /: null\s*\)\s*\),\s*"\u786e\u8ba4\u5220\u9664\u8349\u7a3f"/,
  "delete-drafts must not close modalShell before its remaining arguments"
);
