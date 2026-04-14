import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTradingViewTechnicals } from "../src/sites/tradingview/technicals.mjs";

test("normalizeTradingViewTechnicals maps buy summary to up trend", () => {
  const result = normalizeTradingViewTechnicals({ summary: "Buy", oscillators: "Neutral", movingAverages: "Strong Buy" });
  assert.equal(result.trend, "up");
  assert.equal(result.source, "tradingview");
});

test("normalizeTradingViewTechnicals maps sell summary to down trend", () => {
  const result = normalizeTradingViewTechnicals({ summary: "Strong Sell" });
  assert.equal(result.trend, "down");
});
