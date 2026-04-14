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
      data: { ok: true, symbol: "BABA", followers: "5万", discussions: 1000, hotRank: 42, score: 0 },
    },
  ];
  const result = mergeSentimentResults(succeeded, "BABA");
  assert.equal(result.hot_rank, 42);
});

test("mergeSentimentResults sums mentions across xueqiu, weibo, zhihu, and reddit", () => {
  const result = mergeSentimentResults([
    { name: "xueqiu", data: { ok: true, discussions: 12, hotRank: 5 } },
    { name: "weibo", data: { ok: true, count: 7 } },
    { name: "zhihu", data: { ok: true, count: 3 } },
    { name: "reddit", data: { ok: true, count: 9 } },
  ], "NVDA");

  assert.equal(result.mentions, 31);
  assert.equal(result.hot_rank, 5);
});

test("mergeSentimentResults does not use follower count as hot_rank", () => {
  const result = mergeSentimentResults([
    { name: "xueqiu", data: { ok: true, followers: "20.5万", discussions: 8, hotRank: null } },
  ], "NVDA");

  assert.equal(result.hot_rank, null);
  assert.equal(result.mentions, 8);
});
