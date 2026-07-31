import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../static/app.css", import.meta.url), "utf8");

function declarationsFor(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "s"));
  assert.ok(match, `expected ${selector} styles to exist`);

  return Object.fromEntries(
    match[1]
      .split(";")
      .map((declaration) => declaration.trim())
      .filter(Boolean)
      .map((declaration) => {
        const separator = declaration.indexOf(":");
        return [
          declaration.slice(0, separator).trim(),
          declaration.slice(separator + 1).trim()
        ];
      })
  );
}

const publishBackdrop = declarationsFor(".publish-sheet-backdrop");

assert.equal(
  publishBackdrop["place-items"],
  "center",
  "the publish review dialog must be centered within the full viewport"
);
assert.equal(
  publishBackdrop.padding,
  "24px",
  "the publish review backdrop must use symmetric padding so its visual center matches the viewport center"
);
assert.equal(
  publishBackdrop["align-items"],
  undefined,
  "the publish review must not override vertical centering"
);
assert.equal(
  publishBackdrop["justify-items"],
  undefined,
  "the publish review must not override horizontal centering"
);
