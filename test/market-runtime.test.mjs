import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMarketDrilldownPayload,
  buildMarketScanPayload,
  normalizeSymbols,
} from "../src/commands/market-runtime.mjs";

test("normalizeSymbols deduplicates and uppercases symbols", () => {
  assert.deepEqual(normalizeSymbols("spy, qqq, SPY, nvda"), ["SPY", "QQQ", "NVDA"]);
});

test("buildMarketScanPayload aggregates multiple finance sources without stdout capture", async () => {
  const result = await buildMarketScanPayload(
    {
      symbols: "AAPL,NVDA",
      limit: "5",
      port: "9223",
    },
    {
      fetchPineifyLiveFlow: async () => ({
        ok: true,
        items: [
          {
            ticker: "AAPL",
            sentiment: "bullish",
            premiumValue: 800000,
            contract: "AAPL260417C200",
            volumeRatio: 3.2,
            premium: "$800.00K",
            largeOrder: true,
          },
        ],
      }),
      fetchInsiderFinanceFlow: async () => ({
        ok: true,
        items: [
          {
            ticker: "AAPL",
            smartMoneyDirection: "bullish",
            sizeValue: 1500000,
            flowType: "sweep",
            contractType: "call",
            size: "$1,500,000",
            expiry: "2026-04-17",
            strike: "$200.00",
          },
        ],
      }),
      fetchUnusualWhalesFlow: async () => ({
        ok: true,
        items: [
          {
            ticker: "NVDA",
            sentiment: "bearish",
            premiumValue: 600000,
            premium: "$600.00K",
            expiry: "2026-04-17",
            strike: 90,
            side: "put",
          },
        ],
      }),
      fetchMarketBeatUnusualVolume: async (_flags, side) => ({
        ok: true,
        items: side === "call"
          ? [{ ticker: "AAPL", volumeChange: "250%", price: "1.50", volume: "1200", avgVolume: "300" }]
          : [{ ticker: "NVDA", volumeChange: "300%", price: "2.00", volume: "900", avgVolume: "200" }],
      }),
      fetchWhaleStreamSummary: async () => ({
        ok: true,
        topOptionsFlow: [{ ticker: "AAPL", premium: "$1.20M", orders: "10", contracts: "1000" }],
        topDarkPoolTickers: [{ ticker: "NVDA", size: "$3.40M", flowType: "block", shares: "2M" }],
      }),
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.onlyWatched, true);
  assert.equal(result.count, 2);
  assert.equal(result.items[0].ticker, "AAPL");
  assert.equal(result.items[0].direction, "bullish");
  assert.equal(result.items[0].score, 6);
  assert.equal(result.items[0].activitySignals, 4);
  assert.equal(result.items[1].ticker, "NVDA");
  assert.equal(result.items[1].direction, "bearish");
  assert.equal(result.items[1].score, -3);
  assert.deepEqual(result.errors, []);
});

test("buildMarketDrilldownPayload collects successes and errors from return-first helpers", async () => {
  const result = await buildMarketDrilldownPayload(
    {
      symbol: "QQQ",
      limit: "3",
      port: "9223",
    },
    {
      fetchBarchartQuote: async () => ({ ok: true, symbol: "QQQ", price: 530.12 }),
      fetchBarchartTechnicals: async () => ({ ok: true, symbol: "QQQ", technicalRating: "Buy" }),
      fetchYahooFinanceCatalyst: async () => ({ ok: false, message: "Catalyst temporarily unavailable" }),
      fetchBarchartFlowSymbol: async () => {
        throw new Error("Flow attach failed");
      },
    },
  );

  assert.deepEqual(result.quote, { ok: true, symbol: "QQQ", price: 530.12 });
  assert.deepEqual(result.technicals, { ok: true, symbol: "QQQ", technicalRating: "Buy" });
  assert.equal(result.catalyst, null);
  assert.equal(result.flow, null);
  assert.deepEqual(result.errors, [
    { source: "catalyst", error: "Catalyst temporarily unavailable" },
    { source: "flow", error: "Flow attach failed" },
  ]);
});
