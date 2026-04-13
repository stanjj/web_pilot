import assert from "node:assert/strict";
import test from "node:test";
import { aggregate } from "../src/core/market-aggregator.mjs";

test("aggregate resolves all sources that succeed", async () => {
  const result = await aggregate({
    sources: [
      { name: "a", fetch: async () => ({ value: 1 }) },
      { name: "b", fetch: async () => ({ value: 2 }) },
    ],
    merge: (succeeded) => succeeded.map((s) => s.data),
  });
  assert.deepEqual(result.meta.sources_ok, ["a", "b"]);
  assert.deepEqual(result.meta.sources_skipped, []);
  assert.deepEqual(result.data, [{ value: 1 }, { value: 2 }]);
  assert.ok(typeof result.meta.elapsedMs === "number");
});

test("aggregate skips sources that throw", async () => {
  const result = await aggregate({
    sources: [
      { name: "good", fetch: async () => ({ value: 42 }) },
      { name: "bad", fetch: async () => { throw new Error("network fail"); } },
    ],
    merge: (succeeded) => succeeded.map((s) => s.data),
  });
  assert.deepEqual(result.meta.sources_ok, ["good"]);
  assert.deepEqual(result.meta.sources_skipped, ["bad"]);
  assert.deepEqual(result.data, [{ value: 42 }]);
});

test("aggregate skips sources that exceed timeoutMs", async () => {
  const result = await aggregate({
    sources: [
      { name: "fast", fetch: async () => ({ value: 1 }) },
      { name: "slow", fetch: () => new Promise((resolve) => setTimeout(() => resolve({ value: 2 }), 200)) },
    ],
    timeoutMs: 50,
    merge: (succeeded) => succeeded.map((s) => s.data),
  });
  assert.deepEqual(result.meta.sources_ok, ["fast"]);
  assert.deepEqual(result.meta.sources_skipped, ["slow"]);
});

test("aggregate returns empty data when all sources fail", async () => {
  const result = await aggregate({
    sources: [
      { name: "a", fetch: async () => { throw new Error("fail"); } },
    ],
    merge: (succeeded) => succeeded,
  });
  assert.deepEqual(result.meta.sources_ok, []);
  assert.deepEqual(result.meta.sources_skipped, ["a"]);
  assert.deepEqual(result.data, []);
});
