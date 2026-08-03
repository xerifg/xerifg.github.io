import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { clearModalState } from "../static/library-ui-model.mjs";
const app = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");

assert.deepEqual(
  clearModalState({ modal: "confirm-delete-note", modalContext: { targetId: "note-1" } }),
  { modal: null, modalContext: null },
  "confirming a document deletion must clear the modal state so its backdrop unmounts"
);

assert.match(app, /draft\.modal = action === "delete-note" \? "confirm-delete-note" : "confirm-delete-folder"/);
assert.match(app, /if \(state\.modal === "confirm-delete-note"\)/);
assert.match(app, /if \(state\.modal === "confirm-delete-folder"\)/);
