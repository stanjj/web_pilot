import assert from "node:assert/strict";
import test from "node:test";

import { classifyMoneyness, parseBarchartOptionsResponse } from "../src/sites/barchart/options-helpers.mjs";

const OPTIONS_TEXT = JSON.stringify({
  data: [
    {
      raw: {
        strikePrice: 200,
        bidPrice: 1.234,
        askPrice: 1.456,
        lastPrice: 1.333,
        priceChange: -0.123,
        volume: 10,
        openInterest: 100,
        volatility: 0.34567,
        delta: 0.123456,
        gamma: 0.012345,
        theta: -0.001234,
        vega: 0.055555,
        expirationDate: "2026-04-17",
        optionType: "Call",
        percentFromLast: 0.15,
      },
    },
    {
      raw: {
        strikePrice: 190,
        bidPrice: 2.2,
        askPrice: 2.4,
        lastPrice: 2.3,
        priceChange: 0.2,
        volume: 20,
        openInterest: 200,
        volatility: 0.29876,
        delta: 0.543219,
        gamma: 0.023456,
        theta: -0.002345,
        vega: 0.066666,
        expirationDate: "2026-04-17",
        optionType: "Call",
        percentFromLast: 0.02,
      },
    },
    {
      raw: {
        strikePrice: 185,
        optionType: "Put",
        percentFromLast: 0.01,
      },
    },
  ],
});

test("parseBarchartOptionsResponse filters by type and sorts by distance from last", () => {
  const result = parseBarchartOptionsResponse({
    symbol: "AAPL",
    type: "Call",
    limit: 2,
    status: 200,
    ok: true,
    text: OPTIONS_TEXT,
  });

  assert.equal(result.ok, true);
  assert.equal(result.count, 2);
  assert.equal(result.items[0].strike, 190);
  assert.equal(result.items[0].delta, 0.5432);
  assert.equal(result.items[1].strike, 200);
  assert.equal(result.items[1].change, -0.12);
});

test("parseBarchartOptionsResponse preserves login failures", () => {
  assert.deepEqual(
    parseBarchartOptionsResponse({
      symbol: "AAPL",
      type: "Call",
      limit: 5,
      status: 403,
      ok: false,
      text: "forbidden",
    }),
    {
      ok: false,
      symbol: "AAPL",
      type: "Call",
      needsLogin: true,
      status: 403,
      message: "Barchart options chain requires a logged-in session in the shared agent browser.",
      body: "forbidden",
    },
  );
});

test("parseBarchartOptionsResponse filters by expiration date", () => {
  const text = JSON.stringify({
    data: [
      { raw: { strikePrice: 190, optionType: "Call", expirationDate: "2026-04-17", percentFromLast: 0.02, bidPrice: 2.2, askPrice: 2.4 } },
      { raw: { strikePrice: 195, optionType: "Call", expirationDate: "2026-04-24", percentFromLast: 0.05, bidPrice: 1.0, askPrice: 1.2 } },
    ],
  });

  const result = parseBarchartOptionsResponse({
    symbol: "QQQ", type: "Call", limit: 10, expiration: "2026-04-17", ok: true, status: 200, text,
  });

  assert.equal(result.ok, true);
  assert.equal(result.count, 1);
  assert.equal(result.items[0].expiration, "2026-04-17");
});

test("parseBarchartOptionsResponse filters by strike range", () => {
  const text = JSON.stringify({
    data: [
      { raw: { strikePrice: 180, optionType: "Call", expirationDate: "2026-04-17", percentFromLast: 0.1 } },
      { raw: { strikePrice: 195, optionType: "Call", expirationDate: "2026-04-17", percentFromLast: 0.03 } },
      { raw: { strikePrice: 210, optionType: "Call", expirationDate: "2026-04-17", percentFromLast: 0.15 } },
    ],
  });

  const result = parseBarchartOptionsResponse({
    symbol: "QQQ", type: "Call", limit: 10, strikeMin: 185, strikeMax: 200, ok: true, status: 200, text,
  });

  assert.equal(result.ok, true);
  assert.equal(result.count, 1);
  assert.equal(result.items[0].strike, 195);
});

test("classifyMoneyness returns correct classification", () => {
  assert.equal(classifyMoneyness(100, 100, "Call"), "atm");
  assert.equal(classifyMoneyness(95, 100, "Call"), "itm");
  assert.equal(classifyMoneyness(105, 100, "Call"), "otm");
  assert.equal(classifyMoneyness(95, 100, "Put"), "otm");
  assert.equal(classifyMoneyness(105, 100, "Put"), "itm");
  assert.equal(classifyMoneyness(null, 100, "Call"), null);
  assert.equal(classifyMoneyness(100, 0, "Call"), null);
});
