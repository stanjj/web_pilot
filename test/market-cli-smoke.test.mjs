import assert from "node:assert/strict";
import test from "node:test";
import { mergeFlowResults } from "../src/sites/market/flow.mjs";
import { buildThesis } from "../src/sites/market/thesis.mjs";

test("market thesis envelope always includes ok, symbol, thesis, and meta", () => {
  const result = buildThesis({
    symbol: "NVDA",
    flow: { net_sentiment: "neutral", put_call_ratio: null, notable_trades: [], vol_skew: [], sources: [] },
    quote: null,
    technicals: null,
    sentiment: null,
    meta: { sources_ok: [], sources_skipped: ["barchart"], elapsedMs: 50, command: "market thesis" },
  });

  assert.equal(result.ok, true);
  assert.equal(result.symbol, "NVDA");
  assert.ok(result.thesis);
  assert.ok(result.meta);
});

test("mergeFlowResults copies vol-skew rows into the flow payload", () => {
  const result = mergeFlowResults([
    {
      name: "barchart-vol-skew",
      data: {
        ok: true,
        items: [{ strike: 100, callIV: 0.2, putIV: 0.34, skew: 0.14 }],
      },
    },
  ]);

  assert.deepEqual(result.vol_skew, [{ strike: 100, callIV: 0.2, putIV: 0.34, skew: 0.14 }]);
});
