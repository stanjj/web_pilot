import assert from "node:assert/strict";
import test from "node:test";

import { extractNumber, parseBarchartQuoteDocument } from "../src/sites/barchart/quote-helpers.mjs";

const QUOTE_TEXT = [
  "Acme Holdings (AAPL)",
  "189.21 +1.11 (+0.59%)",
  "Open 188.00",
  "Day Low",
  "187.50",
  "Day High",
  "190.40",
  "Previous Close",
  "188.10",
  "Volume",
  "52,123,456",
  "Average Volume",
  "44,000,000",
].join("\n");

test("extractNumber handles commas and signed text", () => {
  assert.equal(extractNumber("52,123,456"), 52123456);
  assert.equal(extractNumber("-1.23%"), -1.23);
  assert.equal(extractNumber("n/a"), null);
});

test("parseBarchartQuoteDocument normalizes text fields into numbers", () => {
  assert.deepEqual(
    parseBarchartQuoteDocument({
      symbol: "aapl",
      text: QUOTE_TEXT,
      title: "AAPL overview",
      url: "https://www.barchart.com/stocks/quotes/AAPL/overview",
    }),
    {
      ok: true,
      symbol: "AAPL",
      title: "AAPL overview",
      url: "https://www.barchart.com/stocks/quotes/AAPL/overview",
      instrument: "Acme Holdings",
      priceLine: "189.21 +1.11 (+0.59%)",
      price: 189.21,
      dayLow: 187.5,
      dayHigh: 190.4,
      open: 188,
      previousClose: 188.1,
      volume: 52123456,
      averageVolume: 44000000,
      rawHeader: "",
    },
  );
});
