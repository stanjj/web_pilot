import assert from "node:assert/strict";
import test from "node:test";

import { getTradingViewSymbolUrl } from "../src/sites/tradingview/common.mjs";
import { extractTradingViewNumber, isTradingViewSymbolMatch, parseTradingViewQuoteSnapshot, resolveTradingViewSymbolIdentity } from "../src/sites/tradingview/quote.mjs";
import { summarizeTradingViewStatusSnapshot } from "../src/sites/tradingview/status.mjs";

test("getTradingViewSymbolUrl normalizes bare and exchange-qualified symbols", () => {
  assert.equal(getTradingViewSymbolUrl("AAPL"), "https://www.tradingview.com/symbols/AAPL/");
  assert.equal(getTradingViewSymbolUrl("NASDAQ:AAPL"), "https://www.tradingview.com/symbols/NASDAQ-AAPL/");
  assert.equal(getTradingViewSymbolUrl("AAPL", "nasdaq"), "https://www.tradingview.com/symbols/NASDAQ-AAPL/");
});

test("extractTradingViewNumber handles unicode minus and compact suffixes", () => {
  assert.equal(extractTradingViewNumber("−5.36"), -5.36);
  assert.equal(extractTradingViewNumber("43.06%"), 43.06);
  assert.equal(extractTradingViewNumber("197.41 K%"), 197410);
  assert.equal(extractTradingViewNumber("N/A"), null);
});

test("parseTradingViewQuoteSnapshot normalizes symbol page data", () => {
  assert.deepEqual(
    parseTradingViewQuoteSnapshot({
      requestedSymbol: "aapl",
      title: "Apple Stock Chart — NASDAQ:AAPL Stock Price — TradingView",
      url: "https://www.tradingview.com/symbols/NASDAQ-AAPL/",
      symbolInfo: {
        resolved_symbol: "NASDAQ:AAPL",
        short_name: "AAPL",
        description: "Apple Inc.",
        short_description: "Apple Inc.",
        exchange: "NASDAQ",
        exchange_for_display: "NASDAQ",
        source2: { name: "Nasdaq Stock Market" },
        currency: "USD",
        country: "us",
        type: "stock",
        isin_displayed: "US0378331005",
        has_fundamentals: true,
        has_price_snapshot: true,
      },
      lastText: "253.50",
      currencyText: "USD",
      sessionStatusText: "Market closed",
      changeText: "−5.36\n−2.07%",
      lastUpdatedText: "At close at Apr 7, 16:59 GMT-7",
    }),
    {
      ok: true,
      requestedSymbol: "AAPL",
      symbol: "NASDAQ:AAPL",
      title: "Apple Stock Chart — NASDAQ:AAPL Stock Price — TradingView",
      url: "https://www.tradingview.com/symbols/NASDAQ-AAPL/",
      name: "Apple Inc.",
      shortName: "AAPL",
      instrumentType: "stock",
      exchange: "NASDAQ",
      exchangeDisplay: "NASDAQ",
      market: "Nasdaq Stock Market",
      currency: "USD",
      country: "US",
      isin: "US0378331005",
      price: 253.5,
      change: -5.36,
      changePct: -2.07,
      sessionStatus: "Market closed",
      lastUpdated: "At close at Apr 7, 16:59 GMT-7",
      hasFundamentals: true,
      hasPriceSnapshot: true,
    },
  );
});

test("parseTradingViewQuoteSnapshot handles compact single-line change text", () => {
  const result = parseTradingViewQuoteSnapshot({
    requestedSymbol: "AAPL",
    symbolInfo: {
      resolved_symbol: "NASDAQ:AAPL",
      short_name: "AAPL",
      exchange: "NASDAQ",
      exchange_for_display: "NASDAQ",
      currency: "USD",
      country: "us",
    },
    lastText: "253.50",
    changeText: "−5.36 −2.07%",
  });

  assert.equal(result.change, -5.36);
  assert.equal(result.changePct, -2.07);
});

test("parseTradingViewQuoteSnapshot handles compact single-line change text with commas", () => {
  const result = parseTradingViewQuoteSnapshot({
    requestedSymbol: "BIG",
    symbolInfo: {
      resolved_symbol: "NYSE:BIG",
      short_name: "BIG",
      exchange: "NYSE",
      exchange_for_display: "NYSE",
      currency: "USD",
      country: "us",
    },
    lastText: "5,253.50",
    changeText: "1,234.56 2.34%",
  });

  assert.equal(result.change, 1234.56);
  assert.equal(result.changePct, 2.34);
});

test("isTradingViewSymbolMatch accepts canonical redirects for bare symbols", () => {
  assert.equal(isTradingViewSymbolMatch({
    requestedSymbol: "AAPL",
    resolvedSymbol: "NASDAQ:AAPL",
    url: "https://www.tradingview.com/symbols/NASDAQ-AAPL/",
  }), true);
});

test("isTradingViewSymbolMatch rejects mismatched symbols", () => {
  assert.equal(isTradingViewSymbolMatch({
    requestedSymbol: "AAPL",
    resolvedSymbol: "NASDAQ:MSFT",
    url: "https://www.tradingview.com/symbols/NASDAQ-MSFT/",
  }), false);
});

test("isTradingViewSymbolMatch rejects mismatched explicit exchanges", () => {
  assert.equal(isTradingViewSymbolMatch({
    requestedSymbol: "AAPL",
    exchange: "NYSE",
    resolvedSymbol: "NASDAQ:AAPL",
    url: "https://www.tradingview.com/symbols/NASDAQ-AAPL/",
  }), false);
});

test("isTradingViewSymbolMatch fails closed when actual symbol cannot be verified", () => {
  assert.equal(isTradingViewSymbolMatch({
    requestedSymbol: "AAPL",
    resolvedSymbol: "",
    url: "https://www.tradingview.com/markets/stocks-usa/",
  }), false);
});

test("resolveTradingViewSymbolIdentity falls back to canonical symbol URL", () => {
  assert.equal(resolveTradingViewSymbolIdentity({
    url: "https://www.tradingview.com/symbols/NASDAQ-AAPL/",
  }), "NASDAQ:AAPL");
});

test("summarizeTradingViewStatusSnapshot validates a ready TradingView page", () => {
  const result = summarizeTradingViewStatusSnapshot({
    title: "TradingView — Track All Markets",
    url: "https://www.tradingview.com/",
    isAuthenticated: false,
    locale: "en",
    theme: "light",
    hasSearchControl: true,
    hasTradingViewMeta: true,
    hasInitData: true,
    bodyText: "Track All Markets",
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "Connected");
  assert.equal(result.hasInitData, true);
});

test("summarizeTradingViewStatusSnapshot flags blocked pages", () => {
  const result = summarizeTradingViewStatusSnapshot({
    title: "Just a moment...",
    url: "https://www.tradingview.com/",
    hasTradingViewMeta: false,
    hasInitData: false,
    bodyText: "Verify you are human",
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "Blocked");
});