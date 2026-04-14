import assert from "node:assert/strict";
import test from "node:test";
import {
  pickNearestExpirationItems,
  computePutCallRatioMetrics,
} from "../src/sites/barchart/put-call-ratio.mjs";
import {
  buildVolSkewRows,
} from "../src/sites/barchart/vol-skew.mjs";

test("pickNearestExpirationItems keeps only the nearest expiry", () => {
  const items = [
    { raw: { expirationDate: "2026-05-17", optionType: "call", strikePrice: 100, volume: 10, openInterest: 20 } },
    { raw: { expirationDate: "2026-05-17", optionType: "put", strikePrice: 100, volume: 12, openInterest: 22 } },
    { raw: { expirationDate: "2026-06-21", optionType: "call", strikePrice: 100, volume: 90, openInterest: 120 } },
  ];
  const result = pickNearestExpirationItems(items);
  assert.equal(result.length, 2);
  assert.ok(result.every((item) => item.raw.expirationDate === "2026-05-17"));
});

test("computePutCallRatioMetrics returns volume and oi ratios", () => {
  const items = [
    { raw: { expirationDate: "2026-05-17", optionType: "call", strikePrice: 100, volume: 40, openInterest: 80 } },
    { raw: { expirationDate: "2026-05-17", optionType: "put", strikePrice: 100, volume: 20, openInterest: 40 } },
  ];
  const result = computePutCallRatioMetrics(items);
  assert.equal(result.putCallRatio.volume, 0.5);
  assert.equal(result.putCallRatio.openInterest, 0.5);
});

test("buildVolSkewRows computes skew per strike", () => {
  const items = [
    { raw: { expirationDate: "2026-05-17", optionType: "call", strikePrice: 100, volatility: 0.25 } },
    { raw: { expirationDate: "2026-05-17", optionType: "put", strikePrice: 100, volatility: 0.31 } },
  ];
  const result = buildVolSkewRows(items, 20);
  assert.deepEqual(result, [
    { strike: 100, callIV: 0.25, putIV: 0.31, skew: 0.06 },
  ]);
});
