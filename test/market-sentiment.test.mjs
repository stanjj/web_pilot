import assert from "node:assert/strict";
import test from "node:test";
import { mergeSentimentResults } from "../src/sites/market/sentiment.mjs";

test("mergeSentimentResults aggregates mentions across sources", () => {
  const succeeded = [
    { name: "reddit", data: { ok: true, query: "NVDA", count: 12, items: [] } },
    { name: "zhihu", data: { ok: true, keyword: "NVDA", count: 5, items: [] } },
  ];
  const result = mergeSentimentResults(succeeded, "NVDA");
  assert.equal(result.mentions, 17);
  assert.equal(result.sources.length, 2);
});

test("mergeSentimentResults score is 0 when no sources succeed", () => {
  const result = mergeSentimentResults([], "NVDA");
  assert.equal(result.score, 0);
  assert.equal(result.mentions, 0);
  assert.deepEqual(result.sources, []);
});

test("mergeSentimentResults picks hot_rank from xueqiu when available", () => {
  const succeeded = [
    {
      name: "xueqiu",
      data: { ok: true, symbol: "BABA", followers: "5万", discussions: "1000", score: 0 },
    },
  ];
  const result = mergeSentimentResults(succeeded, "BABA");
  assert.equal(result.hot_rank, "5万");
});
