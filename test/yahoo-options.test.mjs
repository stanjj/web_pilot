import assert from "node:assert/strict";
import test from "node:test";

import { parseYahooExpiration, parseYahooFinanceOptionsResponse } from "../src/sites/yahoo-finance/options.mjs";

const OPTIONS_TEXT = JSON.stringify({
  optionChain: {
    result: [
      {
        expirationDates: [1713484800, 1714089600],
        quote: {
          regularMarketPrice: 192.33,
        },
        options: [
          {
            calls: [
              {
                contractSymbol: "AAPL260417C00200000",
                strike: 200,
                currency: "USD",
                lastPrice: 1.5,
                change: -0.1,
                percentChange: -6.25,
                volume: 40,
                openInterest: 100,
                bid: 1.4,
                ask: 1.6,
                impliedVolatility: 0.251234,
                inTheMoney: false,
                contractSize: "REGULAR",
                expiration: 1713484800,
                lastTradeDate: 1712870400,
              },
              {
                contractSymbol: "AAPL260417C00190000",
                strike: 190,
                currency: "USD",
                lastPrice: 3.2,
                change: 0.2,
                percentChange: 6.67,
                volume: 50,
                openInterest: 120,
                bid: 3.1,
                ask: 3.3,
                impliedVolatility: 0.231234,
                inTheMoney: true,
                contractSize: "REGULAR",
                expiration: 1713484800,
                lastTradeDate: 1712870401,
              },
            ],
            puts: [
              {
                contractSymbol: "AAPL260417P00190000",
                strike: 190,
              },
            ],
          },
        ],
      },
    ],
  },
});

test("parseYahooFinanceOptionsResponse sorts by strike distance to the underlying price", () => {
  const result = parseYahooFinanceOptionsResponse({
    symbol: "AAPL",
    type: "calls",
    expiration: 1713484800,
    limit: 1,
    status: 200,
    ok: true,
    text: OPTIONS_TEXT,
  });

  assert.deepEqual(result, {
    ok: true,
    symbol: "AAPL",
    type: "calls",
    requestedExpiration: 1713484800,
    underlyingPrice: 192.33,
    expirationDates: [1713484800, 1714089600],
    count: 1,
    items: [
      {
        contractSymbol: "AAPL260417C00190000",
        strike: 190,
        lastPrice: 3.2,
        change: 0.2,
        percentChange: 6.67,
        volume: 50,
        openInterest: 120,
        bid: 3.1,
        ask: 3.3,
        impliedVolatility: 0.2312,
        inTheMoney: true,
        contractSize: "REGULAR",
        expiration: 1713484800,
        lastTradeDate: 1712870401,
        currency: "USD",
      },
    ],
  });
});

test("parseYahooFinanceOptionsResponse preserves error output shape", () => {
  assert.deepEqual(
    parseYahooFinanceOptionsResponse({
      symbol: "AAPL",
      type: "puts",
      expiration: null,
      limit: 20,
      status: 500,
      ok: false,
      text: "server error",
    }),
    {
      ok: false,
      symbol: "AAPL",
      type: "puts",
      expiration: null,
      status: 500,
      message: "Yahoo Finance options request failed.",
      body: "server error",
    },
  );
});

test("parseYahooExpiration handles UNIX timestamp", () => {
  assert.equal(parseYahooExpiration(1713484800), 1713484800);
  assert.equal(parseYahooExpiration("1713484800"), 1713484800);
});

test("parseYahooExpiration converts YYYY-MM-DD to UTC midnight timestamp", () => {
  const ts = parseYahooExpiration("2024-04-19");
  assert.equal(typeof ts, "number");
  assert.equal(ts, 1713484800);
});

test("parseYahooExpiration returns null for null/undefined", () => {
  assert.equal(parseYahooExpiration(null), null);
  assert.equal(parseYahooExpiration(undefined), null);
  assert.equal(parseYahooExpiration(""), null);
});

test("parseYahooExpiration throws on invalid input", () => {
  assert.throws(() => parseYahooExpiration("not-a-date"), /Invalid --expiration/);
  assert.throws(() => parseYahooExpiration("2024/04/19"), /Invalid --expiration/);
});