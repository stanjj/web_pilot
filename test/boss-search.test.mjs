import assert from "node:assert/strict";
import test from "node:test";

import { normalizeBossSearchResult } from "../src/sites/boss/search-helpers.mjs";

test("normalizeBossSearchResult adds a hint for environment verification blocks", () => {
  const result = normalizeBossSearchResult({
    ok: false,
    error: "BOSS API error",
    code: 37,
    message: "您的环境存在异常.",
  });

  assert.equal(result.error, "BOSS search is blocked by login or environment verification");
  assert.match(result.hint || "", /verification challenge/i);
});

test("normalizeBossSearchResult preserves unrelated failures", () => {
  const original = {
    ok: false,
    error: "BOSS API error",
    code: 500,
    message: "temporary error",
  };

  assert.deepEqual(normalizeBossSearchResult(original), original);
});