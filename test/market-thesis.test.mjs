import assert from "node:assert/strict";
import test from "node:test";
import { computeBias, computeConfidence, buildFlags, buildThesis } from "../src/sites/market/thesis.mjs";

test("computeBias returns bullish when majority of votes are bullish", () => {
  assert.equal(computeBias({ flow: "bullish", putCallRatio: 0.6, technicals: "up" }), "bullish");
});

test("computeBias returns bearish when majority are bearish", () => {
  assert.equal(computeBias({ flow: "bearish", putCallRatio: 1.5, technicals: "down" }), "bearish");
});

test("computeBias returns neutral on tie", () => {
  assert.equal(computeBias({ flow: "bullish", putCallRatio: 1.0, technicals: "down" }), "neutral");
});

test("computeBias returns neutral when all inputs are null", () => {
  assert.equal(computeBias({ flow: null, putCallRatio: null, technicals: null }), "neutral");
});

test("computeConfidence reflects fraction of successful sources", () => {
  assert.equal(computeConfidence(["barchart", "unusual-whales"], ["whalestream"]), Number((2 / 3).toFixed(2)));
});

test("computeConfidence returns 0 when no sources", () => {
  assert.equal(computeConfidence([], []), 0);
});

test("buildFlags detects near-expiry spike", () => {
  const today = new Date();
  const nearExpiry = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const trades = [{ ticker: "NVDA", expiry: nearExpiry, premiumValue: 2000000, side: "call" }];
  const flags = buildFlags(trades);
  assert.ok(flags.some((f) => f.includes("near-expiry")));
});

test("buildFlags detects large premium", () => {
  const trades = [{ ticker: "AAPL", expiry: "2027-01-01", premiumValue: 6000000, side: "put" }];
  const flags = buildFlags(trades);
  assert.ok(flags.some((f) => f.includes("large-premium")));
});

test("buildFlags detects extreme put-call ratio", () => {
  const flags = buildFlags([], { putCallRatio: 1.45, volSkewMaxAbs: null });
  assert.ok(flags.some((flag) => flag.includes("extreme put/call")));
});

test("buildFlags detects high vol-skew divergence", () => {
  const flags = buildFlags([], { putCallRatio: null, volSkewMaxAbs: 0.18 });
  assert.ok(flags.some((flag) => flag.includes("vol-skew")));
});

test("buildThesis preserves elapsedMs in meta", () => {
  const result = buildThesis({
    symbol: "NVDA",
    flow: null,
    quote: null,
    technicals: null,
    sentiment: null,
    meta: { sources_ok: [], sources_skipped: [], elapsedMs: 1234, command: "market thesis" },
  });
  assert.equal(result.meta.elapsedMs, 1234);
});

test("buildThesis returns complete structure", () => {
  const result = buildThesis({
    symbol: "NVDA",
    flow: { net_sentiment: "bullish", put_call_ratio: 0.65, notable_trades: [], sources: ["barchart"] },
    quote: { price: 950, change_pct: 1.5, volume: 40000000, source: "barchart" },
    technicals: { trend: "up", rsi: null, signals: ["Buy"], source: "barchart" },
    sentiment: { score: 0, hot_rank: null, mentions: 15, sources: ["reddit"] },
    meta: { sources_ok: ["barchart", "reddit"], sources_skipped: [] },
  });
  assert.equal(result.thesis.bias, "bullish");
  assert.ok(typeof result.thesis.confidence === "number");
  assert.ok(typeof result.thesis.summary === "string");
  assert.ok(Array.isArray(result.thesis.flags));
});
