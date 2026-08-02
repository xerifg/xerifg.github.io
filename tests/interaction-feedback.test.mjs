import assert from "node:assert/strict";
import { createNotice, dismissNotice, pushNotice } from "../static/interaction-feedback.mjs";

const saved = createNotice("saved", "已保存");
assert.deepEqual(saved, { id: "saved", message: "已保存", tone: "success" });
assert.deepEqual(pushNotice([saved], createNotice("moved", "已移动"), 1).map((item) => item.id), ["moved"]);
assert.deepEqual(dismissNotice([saved], "saved"), []);
