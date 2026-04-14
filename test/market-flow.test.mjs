import assert from "node:assert/strict";
import test from "node:test";
import { toFlowTrades as uwToFlowTrades } from "../src/sites/unusual-whales/flow.mjs";
import { toFlowTrades as wsToFlowTrades } from "../src/sites/whalestream/summary.mjs";
import { mergeFlowResults } from "../src/sites/market/flow.mjs";

// ── unusual-whales adapter ────────────────────────────────────────

test("unusual-whales toFlowTrades maps items to normalized trades", () => {
  const input = {
    ok: true,
    items: [
      {
        ticker: "NVDA",
        side: "call",
        sentiment: "bullish",
        premiumValue: 1200000,
        premium: "$1.20M",
        strike: 950,
        expiry: "2026-05-16",
        size: 100,
      },
    ],
  };
  const result = uwToFlowTrades(input);
  assert.equal(result.length, 1);
  assert.equal(result[0].ticker, "NVDA");
  assert.equal(result[0].side, "call");
  assert.equal(result[0].sentiment, "bullish");
  assert.equal(result[0].premiumValue, 1200000);
  assert.equal(result[0].source, "unusual-whales");
});

test("unusual-whales toFlowTrades returns [] for non-ok input", () => {
  assert.deepEqual(uwToFlowTrades({ ok: false }), []);
  assert.deepEqual(uwToFlowTrades(null), []);
});

// ── whalestream adapter ───────────────────────────────────────────

test("whalestream toFlowTrades maps topOptionsFlow items", () => {
  const input = {
    ok: true,
    topOptionsFlow: [
      { ticker: "AAPL", premium: "$2.50M", orders: "15", contracts: "500" },
    ],
  };
  const result = wsToFlowTrades(input);
  assert.equal(result.length, 1);
  assert.equal(result[0].ticker, "AAPL");
  assert.equal(result[0].premium, "$2.50M");
  assert.equal(result[0].source, "whalestream");
});

test("whalestream toFlowTrades returns [] for non-ok input", () => {
  assert.deepEqual(wsToFlowTrades({ ok: false }), []);
  assert.deepEqual(wsToFlowTrades(null), []);
});

// ── mergeFlowResults ──────────────────────────────────────────────

test("mergeFlowResults produces bullish net_sentiment when most trades are bullish", () => {
  const succeeded = [
    {
      name: "unusual-whales",
      data: {
        ok: true,
        items: [
          { ticker: "NVDA", side: "call", sentiment: "bullish", premiumValue: 1000000, premium: "$1M", strike: 950, expiry: "2026-05-16", size: 50 },
          { ticker: "AAPL", side: "call", sentiment: "bullish", premiumValue: 800000, premium: "$800K", strike: 200, expiry: "2026-05-16", size: 40 },
          { ticker: "SPY", side: "put", sentiment: "bearish", premiumValue: 600000, premium: "$600K", strike: 540, expiry: "2026-04-17", size: 30 },
        ],
      },
    },
  ];
  const result = mergeFlowResults(succeeded);
  assert.equal(result.net_sentiment, "bullish");
  assert.equal(result.sources.length, 1);
  assert.equal(result.notable_trades.length, 3);
});

test("mergeFlowResults returns neutral when no trades", () => {
  const result = mergeFlowResults([]);
  assert.equal(result.net_sentiment, "neutral");
  assert.deepEqual(result.notable_trades, []);
  assert.deepEqual(result.sources, []);
});

test("mergeFlowResults limits notable_trades to top 5 by premiumValue", () => {
  const items = Array.from({ length: 10 }, (_, i) => ({
    ticker: `SYM${i}`,
    side: "call",
    sentiment: "bullish",
    premiumValue: (10 - i) * 100000,
    premium: `$${(10 - i) * 100}K`,
    strike: 100,
    expiry: "2026-05-16",
    size: 10,
  }));
  const succeeded = [{ name: "unusual-whales", data: { ok: true, items } }];
  const result = mergeFlowResults(succeeded);
  assert.equal(result.notable_trades.length, 5);
  assert.equal(result.notable_trades[0].ticker, "SYM0");
});

test("mergeFlowResults uses barchart put/call ratio when available", () => {
  const result = mergeFlowResults([
    {
      name: "barchart-ratio",
      data: {
        ok: true,
        putCallRatio: { volume: 0.72, openInterest: 0.81 },
      },
    },
  ]);

  assert.equal(result.put_call_ratio, 0.72);
});

test("mergeFlowResults keeps the ratio source name in sources", () => {
  const result = mergeFlowResults([
    {
      name: "barchart-ratio",
      data: {
        ok: true,
        putCallRatio: { volume: 0.72, openInterest: 0.81 },
      },
    },
  ]);

  assert.deepEqual(result.sources, ["barchart-ratio"]);
});
