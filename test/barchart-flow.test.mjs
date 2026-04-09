import assert from "node:assert/strict";
import test from "node:test";

import {
  BARCHART_FLOW_FIELDS,
  parseBarchartFlowResponses,
  parseBarchartFlowSymbolResponse,
} from "../src/sites/barchart/flow-helpers.mjs";

function formatDateOffset(days) {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days));
  return date.toISOString().slice(0, 10);
}

test("Barchart flow requests include percentFromLast for derived interpretation fields", () => {
  assert.equal(BARCHART_FLOW_FIELDS.includes("percentFromLast"), true);
});

test("parseBarchartFlowResponses falls back to the next list and normalizes rows", () => {
  const nearExpiry = formatDateOffset(3);
  const farExpiry = formatDateOffset(20);
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
                  expirationDate: nearExpiry,
                  lastPrice: 2.345,
                  volume: 100,
                  openInterest: 200,
                  volumeOpenInterestRatio: 1.987,
                  volatility: 0.4567,
                  percentFromLast: 0.53,
                },
              },
              {
                raw: {
                  baseSymbol: "AAPL",
                  optionType: "call",
                  strikePrice: 195,
                  expirationDate: farExpiry,
                  lastPrice: 5,
                  volume: 80,
                  openInterest: 40,
                  volumeOpenInterestRatio: 2,
                  volatility: 0.52,
                  percentFromLast: 3,
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
  assert.equal(result.count, 2);
  assert.deepEqual(result.items[0], {
    symbol: "AAPL",
    type: "call",
    strike: 190.11,
    expiration: nearExpiry,
    last: 2.35,
    volume: 100,
    openInterest: 200,
    volOiRatio: 1.99,
    volumeOpenInterestRatio: 1.99,
    iv: 0.46,
    percentFromLast: 0.53,
    underlyingPrice: 189.11,
    moneyness: "atm",
    nearAtm: true,
    daysToExpiration: 3,
    nearExpiry: true,
    premiumValue: 23500,
    premium: "$23.50K",
    premiumRank: 2,
  });
  assert.deepEqual(result.items[1], {
    symbol: "AAPL",
    type: "call",
    strike: 195,
    expiration: farExpiry,
    last: 5,
    volume: 80,
    openInterest: 40,
    volOiRatio: 2,
    volumeOpenInterestRatio: 2,
    iv: 0.52,
    percentFromLast: 3,
    underlyingPrice: 189.32,
    moneyness: "otm",
    nearAtm: false,
    daysToExpiration: 20,
    nearExpiry: false,
    premiumValue: 40000,
    premium: "$40.00K",
    premiumRank: 1,
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
  const nearExpiry = formatDateOffset(5);
  const farExpiry = formatDateOffset(18);
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
                expirationDate: nearExpiry,
                lastPrice: 2.25,
                volume: 10,
                openInterest: 20,
                volumeOpenInterestRatio: 1.25,
                volatility: 0.301,
                percentFromLast: -2,
              },
            },
            {
              raw: {
                baseSymbol: "AAPL",
                optionType: "call",
                strikePrice: 195,
                expirationDate: farExpiry,
                lastPrice: 1.5,
                volume: 5,
                openInterest: 50,
                volumeOpenInterestRatio: 0.1,
                volatility: 0.201,
                percentFromLast: 2.5,
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
    sourceList: null,
    count: 2,
    items: [
      {
        symbol: "AAPL",
        type: "call",
        strike: 190,
        expiration: nearExpiry,
        last: 2.25,
        volume: 10,
        openInterest: 20,
        volOiRatio: 1.25,
        volumeOpenInterestRatio: 1.25,
        iv: 0.3,
        percentFromLast: -2,
        underlyingPrice: 193.88,
        moneyness: "itm",
        nearAtm: false,
        daysToExpiration: 5,
        nearExpiry: true,
        premiumValue: 2250,
        premium: "$2.25K",
        premiumRank: 1,
      },
      {
        symbol: "AAPL",
        type: "call",
        strike: 195,
        expiration: farExpiry,
        last: 1.5,
        volume: 5,
        openInterest: 50,
        volOiRatio: 0.1,
        volumeOpenInterestRatio: 0.1,
        iv: 0.2,
        percentFromLast: 2.5,
        underlyingPrice: 190.24,
        moneyness: "otm",
        nearAtm: false,
        daysToExpiration: 18,
        nearExpiry: false,
        premiumValue: 750,
        premium: "$750.00",
        premiumRank: 2,
      },
    ],
  });
});

test("parseBarchartFlowSymbolResponse falls back to the next list for the requested symbol", () => {
  const nearExpiry = formatDateOffset(2);
  const result = parseBarchartFlowSymbolResponse(
    {
      ok: true,
      responses: [
        {
          list: "options.unusual_activity.stocks.us",
          ok: true,
          status: 200,
          text: JSON.stringify({
            data: [
              {
                raw: {
                  baseSymbol: "AAPL",
                  optionType: "call",
                  strikePrice: 200,
                },
              },
            ],
          }),
        },
        {
          list: "options.mostActive.us",
          ok: true,
          status: 200,
          text: JSON.stringify({
            data: [
              {
                raw: {
                  baseSymbol: "FND",
                  optionType: "put",
                  strikePrice: 47.5,
                  expirationDate: nearExpiry,
                  lastPrice: 3.3,
                  volume: 26703,
                  openInterest: 1,
                  volumeOpenInterestRatio: 26703,
                  volatility: 0.58,
                },
              },
            ],
          }),
        },
      ],
    },
    { symbol: "fnd", type: "all", limit: 3 },
  );

  assert.deepEqual(result, {
    ok: true,
    symbol: "FND",
    type: "all",
    sourceList: "options.mostActive.us",
    count: 1,
    items: [
      {
        symbol: "FND",
        type: "put",
        strike: 47.5,
        expiration: nearExpiry,
        last: 3.3,
        volume: 26703,
        openInterest: 1,
        volOiRatio: 26703,
        volumeOpenInterestRatio: 26703,
        iv: 0.58,
        percentFromLast: null,
        underlyingPrice: null,
        moneyness: null,
        nearAtm: false,
        daysToExpiration: 2,
        nearExpiry: true,
        premiumValue: 8811990,
        premium: "$8.81M",
        premiumRank: 1,
      },
    ],
  });
});
