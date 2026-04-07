import assert from "node:assert/strict";
import test from "node:test";

import { getTabOverflow, selectTargetsForClosure } from "../src/core/tab-policy.mjs";

test("getTabOverflow only counts the extra tabs beyond the configured cap", () => {
  assert.equal(getTabOverflow(14, 1, 15), 0);
  assert.equal(getTabOverflow(15, 1, 15), 1);
  assert.equal(getTabOverflow(20, 2, 15), 7);
});

test("selectTargetsForClosure prefers the oldest inspected pages first", () => {
  const result = selectTargetsForClosure([
    { id: "newest", originalIndex: 0, lastLoadedAt: 300 },
    { id: "oldest", originalIndex: 1, lastLoadedAt: 100 },
    { id: "older", originalIndex: 2, lastLoadedAt: 200 },
  ], 2);

  assert.deepEqual(result.map((entry) => entry.id), ["oldest", "older"]);
});

test("selectTargetsForClosure falls back to original order when timestamps are missing", () => {
  const result = selectTargetsForClosure([
    { id: "first", originalIndex: 0, lastLoadedAt: null },
    { id: "second", originalIndex: 1, lastLoadedAt: null },
    { id: "third", originalIndex: 2, lastLoadedAt: null },
  ], 2);

  assert.deepEqual(result.map((entry) => entry.id), ["first", "second"]);
});