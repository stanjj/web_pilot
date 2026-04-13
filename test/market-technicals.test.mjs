import assert from "node:assert/strict";
import test from "node:test";
import { toTechnicalsSchema } from "../src/sites/barchart/technicals.mjs";
import { mergeTechnicalsResults } from "../src/sites/market/technicals.mjs";

test("toTechnicalsSchema extracts trend from technicalRating", () => {
  const barchartData = {
    ok: true,
    symbol: "NVDA",
    technicalRating: "Strong Buy",
    ivRank: 45,
    supportLevels: [900, 880],
    resistanceLevels: [1000, 1050],
  };
  const result = toTechnicalsSchema(barchartData);
  assert.equal(result.trend, "up");
  assert.equal(result.source, "barchart");
  assert.ok(Array.isArray(result.signals));
});

test("toTechnicalsSchema maps bearish ratings to down trend", () => {
  const barchartData = { ok: true, symbol: "NVDA", technicalRating: "Sell", ivRank: 60 };
  const result = toTechnicalsSchema(barchartData);
  assert.equal(result.trend, "down");
});

test("toTechnicalsSchema returns null for non-ok data", () => {
  assert.equal(toTechnicalsSchema({ ok: false }), null);
  assert.equal(toTechnicalsSchema(null), null);
});

test("mergeTechnicalsResults picks barchart when available", () => {
  const succeeded = [
    {
      name: "barchart",
      data: { ok: true, symbol: "NVDA", technicalRating: "Buy", ivRank: 40, supportLevels: [], resistanceLevels: [] },
    },
  ];
  const result = mergeTechnicalsResults(succeeded);
  assert.equal(result.source, "barchart");
  assert.equal(result.trend, "up");
});

test("mergeTechnicalsResults returns null when no sources", () => {
  assert.equal(mergeTechnicalsResults([]), null);
});
