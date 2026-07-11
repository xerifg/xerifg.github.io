import assert from "node:assert/strict";
import { compareTableValues, sortTableRows } from "../static/table-model.mjs";

assert.ok(compareTableValues("2", "12") < 0, "numeric-looking cell text should compare numerically");
assert.ok(compareTableValues("Beta", "alpha") > 0, "text comparison should ignore case");

const rows = [
  { id: "header", values: ["名称", "数量"] },
  { id: "beta", values: ["Beta", "12"] },
  { id: "alpha", values: ["alpha", "2"] },
  { id: "empty", values: ["", ""] }
];

assert.deepEqual(
  sortTableRows(rows, 1, "asc").map((row) => row.id),
  ["header", "alpha", "beta", "empty"],
  "ascending sorting should preserve the header and place blanks last"
);

assert.deepEqual(
  sortTableRows(rows, 0, "desc").map((row) => row.id),
  ["header", "beta", "alpha", "empty"],
  "descending sorting should retain a stable header and blank placement"
);

assert.deepEqual(sortTableRows(rows, 4, "asc"), rows, "an unavailable column should leave rows unchanged");
