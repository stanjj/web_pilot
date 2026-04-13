import assert from "node:assert/strict";
import test from "node:test";
import { mergeQuoteResults } from "../src/sites/market/quote.mjs";

test("mergeQuoteResults picks barchart when available", () => {
  const succeeded = [
    { name: "barchart", data: { ok: true, symbol: "NVDA", price: 950.5, changePct: 2.1, volume: 50000000 } },
    { name: "yahoo-finance", data: { ok: true, symbol: "NVDA", price: 951, changePct: 2.2, volume: 49000000 } },
  ];
  const result = mergeQuoteResults(succeeded, "NVDA");
  assert.equal(result.source, "barchart");
  assert.equal(result.price, 950.5);
  assert.equal(result.change_pct, 2.1);
});

test("mergeQuoteResults falls back to yahoo-finance when barchart missing", () => {
  const succeeded = [
    { name: "yahoo-finance", data: { ok: true, symbol: "NVDA", price: 951, changePct: 2.2, volume: 49000000 } },
  ];
  const result = mergeQuoteResults(succeeded, "NVDA");
  assert.equal(result.source, "yahoo-finance");
  assert.equal(result.price, 951);
});

test("mergeQuoteResults returns null when no sources succeed", () => {
  const result = mergeQuoteResults([], "NVDA");
  assert.equal(result, null);
});
