import assert from "node:assert/strict";
import test from "node:test";

import {
  ensureMarketBeatPath,
  ensureMarketBeatReady,
  summarizeMarketBeatPage,
} from "../src/sites/marketbeat/helpers.mjs";

function rerank(items) {
  return items.map((item, index) => ({
    rank: index + 1,
    ...item,
  }));
}

test("summarizeMarketBeatPage accepts a normal MarketBeat page", () => {
  assert.deepEqual(
    summarizeMarketBeatPage({
      url: "https://www.marketbeat.com/",
      title: "MarketBeat: Stock Market News and Research Tools",
      bodyText: "Stock market news and research tools",
    }),
    {
      ok: true,
      status: "Connected",
      url: "https://www.marketbeat.com/",
      title: "MarketBeat: Stock Market News and Research Tools",
      blocked: false,
    },
  );
});

test("summarizeMarketBeatPage flags Cloudflare challenge pages", () => {
  const result = summarizeMarketBeatPage({
    url: "https://www.marketbeat.com/market-data/unusual-call-options-volume/",
    title: "Just a moment...",
    bodyText: "Verify you are human Enable JavaScript and cookies to continue",
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "Blocked");
  assert.equal(result.blocked, true);
});

test("ensureMarketBeatReady throws a blocked error for challenge pages", () => {
  assert.throws(
    () => ensureMarketBeatReady({
      url: "https://www.marketbeat.com/market-data/unusual-call-options-volume/",
      title: "Just a moment...",
      bodyText: "Verify you are human",
    }),
    /MarketBeat is currently behind a bot or Cloudflare challenge/,
  );
});

test("ensureMarketBeatPath throws when MarketBeat redirects away from the requested dataset page", () => {
  assert.throws(
    () => ensureMarketBeatPath(
      {
        url: "https://www.marketbeat.com/",
        title: "MarketBeat: Stock Market News and Research Tools",
      },
      "/market-data/unusual-call-options-volume/",
    ),
    /MarketBeat did not stay on the expected page/,
  );
});

test("marketbeat result ranking should stay sequential after filtering", () => {
  assert.deepEqual(
    rerank([
      { ticker: "AAA" },
      { ticker: "BBB" },
      { ticker: "CCC" },
    ]),
    [
      { rank: 1, ticker: "AAA" },
      { rank: 2, ticker: "BBB" },
      { rank: 3, ticker: "CCC" },
    ],
  );
});
