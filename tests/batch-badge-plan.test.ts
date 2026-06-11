import * as assert from "node:assert/strict";
import { test } from "node:test";
import {
  createBadgeSequence,
  resolveDefaultBatchBadgeMode,
} from "../src/services/BatchBadgePlan";

test("只有混合选区默认仅补未标记卡片", () => {
  assert.equal(resolveDefaultBatchBadgeMode(5, 2), "missing");
  assert.equal(resolveDefaultBatchBadgeMode(5, 5), "all");
  assert.equal(resolveDefaultBatchBadgeMode(5, 0), "all");
});

test("层级起始标记递增最后一段", () => {
  assert.deepEqual(createBadgeSequence("2.3", 3), ["2.3", "2.4", "2.5"]);
});
