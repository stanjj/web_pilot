import assert from "node:assert/strict";
import test from "node:test";

import { extractNumber, parseYahooFinanceQuoteDocument } from "../src/sites/yahoo-finance/quote-helpers.mjs";

const QUOTE_TEXT = [
  "Vanguard S&P 500 ETF (VOO)",
  "500.12",
  "+1.23",
  "+0.25%",
  "Previous Close",
  "498.89",
  "Open",
  "499.50",
  "Bid",
  "500.00 x 1200",
  "Ask",
  "500.20 x 800",
  "Day's Range",
  "498.10 - 501.00",
  "52 Week Range",
  "390.00 - 520.00",
  "Volume",
  "4,321,000",
  "Avg. Volume",
  "5,000,000",
  "Net Assets",
  "$500.1B",
  "PE Ratio (TTM)",
  "24.56",
  "Yield",
  "1.23%",
  "Beta (5Y Monthly)",
  "1.00",
  "Expense Ratio (net)",
  "0.03%",
].join("\n");

test("extractNumber handles commas and percentages", () => {
  assert.equal(extractNumber("+0.25%"), 0.25);
  assert.equal(extractNumber("4,321,000"), 4321000);
  assert.equal(extractNumber("N/A"), null);
});

test("parseYahooFinanceQuoteDocument preserves current text and numeric field behavior", () => {
  assert.deepEqual(
    parseYahooFinanceQuoteDocument({
      symbol: "voo",
      text: QUOTE_TEXT,
      title: "VOO quote",
      url: "https://finance.yahoo.com/quote/VOO",
    }),
    {
      ok: true,
      symbol: "VOO",
      title: "VOO quote",
      url: "https://finance.yahoo.com/quote/VOO",
      instrument: "Vanguard S&P 500 ETF (VOO)",
      price: 500.12,
      change: 1.23,
      changePct: 0.25,
      previousClose: 498.89,
      open: 499.5,
      bid: "500.00 x 1200",
      ask: "500.20 x 800",
      dayRange: "498.10 - 501.00",
      weekRange: "390.00 - 520.00",
      volume: 4321000,
      averageVolume: 5000000,
      netAssets: "$500.1B",
      peRatio: 24.56,
      yield: "1.23%",
      beta: 1,
      expenseRatio: "0.03%",
    },
  );
});
