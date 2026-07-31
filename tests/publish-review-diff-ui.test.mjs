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
  /className: "publish-sheet"/,
  "publishing should open inside the dedicated review sheet"
);

assert.match(appSource, /发表到 GitHub/, "the sheet should name the GitHub publishing destination");
assert.match(appSource, /className: "publish-destination"/, "the sheet should expose repository and branch details");
assert.match(appSource, /仓库/, "the destination should label the repository");
assert.match(appSource, /分支/, "the destination should label the branch");
assert.match(appSource, /本次变更/, "the sheet should group detected changes");
assert.match(appSource, /className: "publish-tags"/, "the sheet should show public tags from selected note changes");
assert.match(appSource, /公开标签/, "the public tag section should have a visible label");
assert.match(appSource, /查看发布差异/, "publish review rows should expose a visible publish diff trigger");
assert.match(
  appSource,
  /未选中的改动会继续保留为本地草稿/,
  "the sheet should explain that unselected changes remain local drafts"
);
assert.match(
  appSource,
  /className: "publish-sheet-footer"/,
  "the sheet should keep selection status and actions in a dedicated footer"
);
assert.match(appSource, /确认发表/, "the primary action should clearly confirm publishing");
assert.match(appSource, /className: "publish-sheet-error", role: "alert"/, "publish failures should remain visible inside the sheet");
assert.match(appSource, /setToast\("已发表到 GitHub"\)/, "success feedback should appear only after GitHub publishing completes");
assert.match(
  appSource,
  /draft\.modal = "publish-review";[\s\S]*?draft\.modalContext\.review\.selectedIds = Array\.from\(selectedIds\)/,
  "starting a publish should preserve the sheet and its exact selected changes"
);
assert.match(
  appSource,
  /role: "dialog", "aria-modal": "true", "aria-labelledby": "publish-sheet-title"/,
  "the publish sheet should expose modal dialog semantics"
);
assert.match(
  appSource,
  /["']?aria-label["']?\s*:\s*"关闭发表审阅"/,
  "the publish sheet should provide an accessible close control"
);
assert.match(appSource, /closeButtonRef\.current\?\.focus\(\)/, "opening the sheet should move focus into the dialog");
assert.match(appSource, /event\.key === "Escape"/, "Escape should close the publish sheet");
assert.match(appSource, /"data-publish-trigger": ""/, "the mounted top-bar Publish control should expose a stable focus-return target");
assert.match(appSource, /returnFocusSelector:\s*publishTriggerSelector/, "the sheet should receive the explicit Publish focus target");
assert.match(
  appSource,
  /resolvePublishReviewReturnTarget\(explicitReturnFocus, previousFocus\)\?\.focus\(\)/,
  "closing the sheet should prefer the connected explicit Publish target over a stale modal control"
);
assert.doesNotMatch(appSource, /previousFocus\?\.focus\(\)/, "the sheet must not blindly focus a detached previous modal control");

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
assert.match(cssSource, /\.publish-sheet\s*\{[^}]*border-radius:\s*18px/s, "the publish sheet should use the approved 18px material radius");
assert.match(cssSource, /\.publish-sheet\s*\{[^}]*transform-origin:\s*calc\(100% - 80px\) 0/s, "the sheet should animate from the publish control's top-right origin");
assert.match(cssSource, /@keyframes publishSheetIn\s*\{[^}]*transform:\s*scale\(/s, "the sheet should use a short scale and fade entrance");
assert.match(
  cssSource,
  /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.publish-sheet\s*\{[^}]*transform:\s*none/s,
  "reduced motion should replace sheet scaling with an opacity-only cross-fade"
);
assert.match(
  indexSource,
  /app\.js\?v=20260731-library-v1/,
  "the page should request the publish diff script instead of a cached script"
);

assert.match(
  indexSource,
  /app\.css\?v=20260731-library-v1/,
  "the page should request the publish diff styles instead of cached styles"
);
assert.match(
  appSource,
  /loadPublishedDocumentFallback/,
  "publish review should fall back to the already published local document JSON when GitHub document details are unavailable"
);
assert.match(
  appSource,
  /from "\.\/publish-model\.mjs\?v=20260731-library-v1"/,
  "the app should version the publish model import so Chrome does not reuse a stale cached module"
);
