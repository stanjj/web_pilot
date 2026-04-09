import assert from "node:assert/strict";
import test from "node:test";

import {
  parseBarchartFlowResponses,
  parseBarchartFlowSymbolResponse,
} from "../src/sites/barchart/flow-helpers.mjs";

test("parseBarchartFlowResponses falls back to the next list and normalizes rows", () => {
  const result = parseBarchartFlowResponses(
    {
      ok: true,
      responses: [
        {
          list: "options.unusual_activity.stocks.us",
          ok: true,
          status: 200,
          text: JSON.stringify({ data: [] }),
        },
        {
          list: "options.mostActive.us",
          ok: true,
          status: 200,
          text: JSON.stringify({
            data: [
              {
                raw: {
                  baseSymbol: "AAPL",
                  optionType: "call",
                  strikePrice: 190.111,
                  expirationDate: "2026-04-17",
                  lastPrice: 2.345,
                  volume: 100,
                  openInterest: 200,
                  volumeOpenInterestRatio: 1.987,
                  volatility: 0.4567,
                },
              },
              {
                raw: {
                  baseSymbol: "AAPL",
                  optionType: "put",
                  strikePrice: 185,
                },
              },
            ],
          }),
        },
      ],
    },
    { type: "call", limit: 5 },
  );

  assert.equal(result.ok, true);
  assert.equal(result.sourceList, "options.mostActive.us");
  assert.equal(result.count, 1);
  assert.deepEqual(result.items[0], {
    symbol: "AAPL",
    type: "call",
    strike: 190.11,
    expiration: "2026-04-17",
    last: 2.35,
    volume: 100,
    openInterest: 200,
    volOiRatio: 1.99,
    iv: 0.46,
  });
});

test("parseBarchartFlowResponses preserves login failures", () => {
  const result = parseBarchartFlowResponses(
    {
      ok: true,
      responses: [
        {
          list: "options.unusual_activity.stocks.us",
          ok: false,
          status: 401,
          text: "denied",
        },
      ],
    },
    { type: "all", limit: 5 },
  );

  assert.deepEqual(result, {
    ok: false,
    type: "all",
    status: 401,
    needsLogin: true,
    message: "Barchart options flow requires a valid session in the shared agent browser.",
    body: "denied",
  });
});

test("parseBarchartFlowSymbolResponse filters by symbol and type without browser state", () => {
  const result = parseBarchartFlowSymbolResponse(
    {
      ok: true,
      response: {
        ok: true,
        status: 200,
        text: JSON.stringify({
          data: [
            {
              raw: {
                baseSymbol: "AAPL",
                optionType: "call",
                strikePrice: 190,
                expirationDate: "2026-04-17",
                lastPrice: 2.25,
                volume: 10,
                openInterest: 20,
                volumeOpenInterestRatio: 1.25,
                volatility: 0.301,
              },
            },
            {
              raw: {
                baseSymbol: "AAPL",
                optionType: "put",
                strikePrice: 185,
              },
            },
            {
              raw: {
                baseSymbol: "MSFT",
                optionType: "call",
                strikePrice: 400,
              },
            },
          ],
        }),
      },
    },
    { symbol: "aapl", type: "call", limit: 3 },
  );

  assert.deepEqual(result, {
    ok: true,
    symbol: "AAPL",
    type: "call",
    count: 1,
    items: [
      {
        symbol: "AAPL",
        type: "call",
        strike: 190,
        expiration: "2026-04-17",
        last: 2.25,
        volume: 10,
        openInterest: 20,
        volOiRatio: 1.25,
        iv: 0.3,
      },
    ],
  });
});
