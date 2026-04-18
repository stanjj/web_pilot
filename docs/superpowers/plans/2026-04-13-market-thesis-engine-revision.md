# Market Thesis Engine Revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the existing `market` command set so that flow, quote, technicals, sentiment, and thesis all match the revised design contract and degrade gracefully under partial source failure.

**Architecture:** Keep `src/sites/market/*.mjs` as the orchestration layer and add only thin source-specific adapters where the current implementation is incomplete. Use pure helper functions for parsing and merge logic so the critical behavior is covered by `node:test` without depending on live sites.

**Tech Stack:** Node.js ESM, `node:test`, `node:assert/strict`, CDP helpers in `src/core/cdp.mjs`, existing site modules under `src/sites/`

**Spec:** `docs/superpowers/specs/2026-04-13-market-thesis-engine-design-revision.md`

---

## File Map

### Create

| File | Responsibility |
|---|---|
| `src/sites/tradingview/technicals.mjs` | Fetch and normalize TradingView technical summary into the market technicals schema |
| `test/barchart-option-signals.test.mjs` | Unit-test pure Barchart helpers for put/call ratio and vol-skew |
| `test/tradingview-technicals.test.mjs` | Unit-test TradingView technical summary normalization |
| `test/market-cli-smoke.test.mjs` | CLI-level smoke tests for stable `market` envelopes under mocked source responses |

### Modify

| File | Responsibility |
|---|---|
| `src/sites/barchart/put-call-ratio.mjs` | Add pure computation helpers and a fetch function usable by `market flow` |
| `src/sites/barchart/vol-skew.mjs` | Add pure parser helpers and a fetch function usable by `market thesis` |
| `src/sites/xueqiu/symbol-sentiment.mjs` | Return explicit `hotRank` and `discussions` semantics for market sentiment |
| `src/sites/market/flow.mjs` | Fill `put_call_ratio` using Barchart and keep notable trade normalization stable |
| `src/sites/market/technicals.mjs` | Merge `barchart` and `tradingview` technicals conservatively |
| `src/sites/market/sentiment.mjs` | Fix `mentions`, `hot_rank`, and source normalization semantics |
| `src/sites/market/thesis.mjs` | Expand rule-based flags, preserve elapsed timing metadata, and keep partial thesis output valid |
| `src/sites/tradingview/index.mjs` | Export the new TradingView technicals runner |
| `src/command-registrations.mjs` | Register `tradingview technicals` and keep market command coverage aligned |
| `test/market-flow.test.mjs` | Add assertions for `put_call_ratio` population and metadata stability |
| `test/market-technicals.test.mjs` | Add assertions for TradingView merge behavior and tie-to-sideways logic |
| `test/market-sentiment.test.mjs` | Add assertions for `mentions` and `hot_rank` semantics |
| `test/market-thesis.test.mjs` | Add assertions for extreme put/call and vol-skew flags plus timing/meta behavior |

---

## Task 1: Add Pure Barchart Option Signal Helpers

**Files:**
- Modify: `src/sites/barchart/put-call-ratio.mjs`
- Modify: `src/sites/barchart/vol-skew.mjs`
- Create: `test/barchart-option-signals.test.mjs`

- [ ] **Step 1.1: Write the failing helper tests**

```js
// test/barchart-option-signals.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import {
  pickNearestExpirationItems,
  computePutCallRatioMetrics,
} from "../src/sites/barchart/put-call-ratio.mjs";
import {
  buildVolSkewRows,
} from "../src/sites/barchart/vol-skew.mjs";

test("pickNearestExpirationItems keeps only the nearest expiry", () => {
  const items = [
    { raw: { expirationDate: "2026-05-17", optionType: "call", strikePrice: 100, volume: 10, openInterest: 20 } },
    { raw: { expirationDate: "2026-05-17", optionType: "put", strikePrice: 100, volume: 12, openInterest: 22 } },
    { raw: { expirationDate: "2026-06-21", optionType: "call", strikePrice: 100, volume: 90, openInterest: 120 } },
  ];
  const result = pickNearestExpirationItems(items);
  assert.equal(result.length, 2);
  assert.ok(result.every((item) => item.raw.expirationDate === "2026-05-17"));
});

test("computePutCallRatioMetrics returns volume and oi ratios", () => {
  const items = [
    { raw: { expirationDate: "2026-05-17", optionType: "call", strikePrice: 100, volume: 40, openInterest: 80 } },
    { raw: { expirationDate: "2026-05-17", optionType: "put", strikePrice: 100, volume: 20, openInterest: 40 } },
  ];
  const result = computePutCallRatioMetrics(items);
  assert.equal(result.putCallRatio.volume, 0.5);
  assert.equal(result.putCallRatio.openInterest, 0.5);
});

test("buildVolSkewRows computes skew per strike", () => {
  const items = [
    { raw: { expirationDate: "2026-05-17", optionType: "call", strikePrice: 100, volatility: 0.25 } },
    { raw: { expirationDate: "2026-05-17", optionType: "put", strikePrice: 100, volatility: 0.31 } },
  ];
  const result = buildVolSkewRows(items, 20);
  assert.deepEqual(result, [
    { strike: 100, callIV: 0.25, putIV: 0.31, skew: 0.06 },
  ]);
});
```

- [ ] **Step 1.2: Run the helper tests to verify they fail**

```bash
node --test test/barchart-option-signals.test.mjs
```

Expected: FAIL with missing exports such as `pickNearestExpirationItems`, `computePutCallRatioMetrics`, or `buildVolSkewRows`.

- [ ] **Step 1.3: Add pure helpers to `src/sites/barchart/put-call-ratio.mjs`**

```js
export function pickNearestExpirationItems(items) {
  const expirations = [...new Set(
    items
      .map((item) => (item?.raw || item)?.expirationDate || null)
      .filter(Boolean),
  )].sort((a, b) => Date.parse(a) - Date.parse(b));

  const nearest = expirations[0];
  if (!nearest) return items;
  return items.filter((item) => ((item?.raw || item)?.expirationDate || null) === nearest);
}

export function computePutCallRatioMetrics(items) {
  const rows = pickNearestExpirationItems(items);
  const calls = rows.filter((item) => ((item?.raw || item)?.optionType || "").toLowerCase() === "call");
  const puts = rows.filter((item) => ((item?.raw || item)?.optionType || "").toLowerCase() === "put");
  const sumField = (arr, field) => arr.reduce((acc, item) => {
    const value = Number((item?.raw || item)?.[field]);
    return acc + (Number.isFinite(value) ? value : 0);
  }, 0);

  const callVolume = sumField(calls, "volume");
  const putVolume = sumField(puts, "volume");
  const callOI = sumField(calls, "openInterest");
  const putOI = sumField(puts, "openInterest");

  return {
    putCallRatio: {
      volume: callVolume > 0 ? round(putVolume / callVolume, 4) : null,
      openInterest: callOI > 0 ? round(putOI / callOI, 4) : null,
      callVolume,
      putVolume,
      callOI,
      putOI,
    },
  };
}
```

- [ ] **Step 1.4: Add pure helpers to `src/sites/barchart/vol-skew.mjs`**

```js
export function buildVolSkewRows(items, limit = 20) {
  const rows = new Map();

  for (const item of items) {
    const raw = item?.raw || item;
    const strike = Number(raw?.strikePrice);
    const iv = Number(raw?.volatility);
    const optionType = String(raw?.optionType || "").toLowerCase();
    if (!Number.isFinite(strike) || !Number.isFinite(iv)) continue;

    if (!rows.has(strike)) {
      rows.set(strike, { strike, callIV: null, putIV: null });
    }

    const entry = rows.get(strike);
    if (optionType === "call") entry.callIV = round(iv);
    if (optionType === "put") entry.putIV = round(iv);
  }

  return [...rows.values()]
    .sort((a, b) => a.strike - b.strike)
    .map((entry) => ({
      strike: entry.strike,
      callIV: entry.callIV,
      putIV: entry.putIV,
      skew: entry.callIV != null && entry.putIV != null ? round(entry.putIV - entry.callIV) : null,
    }))
    .slice(0, limit);
}
```

- [ ] **Step 1.5: Add fetch functions usable by market orchestration**

```js
// src/sites/barchart/put-call-ratio.mjs
export async function fetchBarchartPutCallRatio(flags) {
  const symbol = String(flags.symbol || "").trim().toUpperCase();
  const expiration = flags.expiration ? String(flags.expiration).trim() : null;
  const port = getBarchartPort(flags.port);
  if (!symbol) throw new Error("Missing required --symbol");
  if (expiration && !/^\d{4}-\d{2}-\d{2}$/.test(expiration)) {
    throw new Error("Invalid --expiration. Use YYYY-MM-DD format");
  }

  const chainRows = await fetchBarchartOptionChainRows({ symbol, expiration, port });
  const metrics = computePutCallRatioMetrics(chainRows);
  return {
    ok: true,
    symbol,
    expiration: expiration ?? ((pickNearestExpirationItems(chainRows)[0]?.raw || pickNearestExpirationItems(chainRows)[0])?.expirationDate ?? null),
    ...metrics,
  };
}

// src/sites/barchart/vol-skew.mjs
export async function fetchBarchartVolSkew(flags) {
  const symbol = String(flags.symbol || "").trim().toUpperCase();
  const expiration = flags.expiration ? String(flags.expiration).trim() : null;
  const limit = Number(flags.limit ?? 20);
  const port = getBarchartPort(flags.port);
  if (!symbol) throw new Error("Missing required --symbol");
  if (expiration && !/^\d{4}-\d{2}-\d{2}$/.test(expiration)) {
    throw new Error("Invalid --expiration. Use YYYY-MM-DD format");
  }

  const chainRows = await fetchBarchartOptionChainRows({ symbol, expiration, port });
  const scopedRows = expiration ? chainRows : pickNearestExpirationItems(chainRows);
  return {
    ok: true,
    symbol,
    expiration: expiration ?? ((scopedRows[0]?.raw || scopedRows[0])?.expirationDate ?? null),
    count: Math.min(scopedRows.length, limit),
    items: buildVolSkewRows(scopedRows, limit),
  };
}
```

- [ ] **Step 1.6: Run the helper tests to verify they pass**

```bash
node --test test/barchart-option-signals.test.mjs
```

Expected: PASS with 3 tests passing.

- [ ] **Step 1.7: Commit**

```bash
git add src/sites/barchart/put-call-ratio.mjs src/sites/barchart/vol-skew.mjs test/barchart-option-signals.test.mjs
git commit -m "feat: add reusable barchart option signal helpers"
```

---

## Task 2: Fill `market flow.put_call_ratio`

**Files:**
- Modify: `src/sites/market/flow.mjs`
- Modify: `test/market-flow.test.mjs`

- [ ] **Step 2.1: Add failing tests for Barchart ratio integration**

```js
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
```

- [ ] **Step 2.2: Run the flow tests to verify they fail**

```bash
node --test test/market-flow.test.mjs
```

Expected: FAIL because `mergeFlowResults()` does not yet read a Barchart ratio source.

- [ ] **Step 2.3: Wire Barchart ratio into `src/sites/market/flow.mjs`**

```js
import { fetchBarchartPutCallRatio } from "../barchart/put-call-ratio.mjs";

export function mergeFlowResults(succeeded) {
  const allTrades = [];
  let putCallRatio = null;

  for (const { name, data } of succeeded) {
    if (name === "barchart-ratio" && data?.ok) {
      putCallRatio = data.putCallRatio?.volume ?? data.putCallRatio?.openInterest ?? null;
      continue;
    }
    if (name === "unusual-whales") {
      allTrades.push(...uwToFlowTrades(data));
      continue;
    }
    if (name === "whalestream") {
      allTrades.push(...wsToFlowTrades(data));
      continue;
    }
    if (name === "barchart" && data?.ok && Array.isArray(data.items)) {
      allTrades.push(
        ...data.items.map((item) => ({
          ticker: item.ticker ?? null,
          side: item.side ?? null,
          sentiment: item.sentiment ?? null,
          premiumValue: item.premiumValue ?? null,
          premium: item.premium ?? null,
          strike: item.strike ?? null,
          expiry: item.expiry ?? null,
          size: item.size ?? null,
          source: "barchart",
        })),
      );
    }
  }

  return {
    net_sentiment: netSentiment,
    put_call_ratio: putCallRatio,
    notable_trades: notableTrades,
    sources: succeeded.map((s) => s.name),
  };
}
```

- [ ] **Step 2.4: Add the ratio source to the aggregate source list**

```js
const { data: flow, meta } = await aggregate({
  sources: [
    { name: "barchart", fetch: () => fetchBarchartFlowSymbol({ symbol, port }) },
    { name: "barchart-ratio", fetch: () => fetchBarchartPutCallRatio({ symbol, port }) },
    { name: "unusual-whales", fetch: () => fetchUnusualWhalesFlow({ port, limit: 30 }) },
    { name: "whalestream", fetch: () => fetchWhaleStreamSummary({ port }) },
  ],
  timeoutMs,
  merge: mergeFlowResults,
});
```

- [ ] **Step 2.5: Run the flow tests to verify they pass**

```bash
node --test test/market-flow.test.mjs
```

Expected: PASS with the new put/call ratio assertions succeeding.

- [ ] **Step 2.6: Commit**

```bash
git add src/sites/market/flow.mjs test/market-flow.test.mjs
git commit -m "feat: populate market flow put-call ratio from barchart"
```

---

## Task 3: Add TradingView Technicals And Merge Conservatively

**Files:**
- Create: `src/sites/tradingview/technicals.mjs`
- Modify: `src/sites/tradingview/index.mjs`
- Modify: `src/sites/market/technicals.mjs`
- Create: `test/tradingview-technicals.test.mjs`
- Modify: `test/market-technicals.test.mjs`

- [ ] **Step 3.1: Write failing tests for TradingView technical normalization**

```js
// test/tradingview-technicals.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTradingViewTechnicals } from "../src/sites/tradingview/technicals.mjs";

test("normalizeTradingViewTechnicals maps buy summary to up trend", () => {
  const result = normalizeTradingViewTechnicals({ summary: "Buy", oscillators: "Neutral", movingAverages: "Strong Buy" });
  assert.equal(result.trend, "up");
  assert.equal(result.source, "tradingview");
});

test("normalizeTradingViewTechnicals maps sell summary to down trend", () => {
  const result = normalizeTradingViewTechnicals({ summary: "Strong Sell" });
  assert.equal(result.trend, "down");
});
```

```js
// Add to test/market-technicals.test.mjs
test("mergeTechnicalsResults returns sideways when barchart and tradingview disagree", () => {
  const result = mergeTechnicalsResults([
    { name: "barchart", data: { ok: true, technicalRating: "Buy", rsi14: 62 } },
    { name: "tradingview", data: { ok: true, technicals: { trend: "down", rsi: null, signals: ["Strong Sell"], source: "tradingview" } } },
  ]);
  assert.equal(result.trend, "sideways");
});
```

- [ ] **Step 3.2: Run the technical tests to verify they fail**

```bash
node --test test/tradingview-technicals.test.mjs test/market-technicals.test.mjs
```

Expected: FAIL because `src/sites/tradingview/technicals.mjs` does not exist and `mergeTechnicalsResults()` only understands Barchart.

- [ ] **Step 3.3: Create `src/sites/tradingview/technicals.mjs`**

```js
import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectTradingViewPage, getTradingViewPort, getTradingViewSymbolUrl } from "./common.mjs";

export function normalizeTradingViewTechnicals(snapshot) {
  const summary = String(snapshot?.summary || "").toLowerCase();
  const trend = summary.includes("buy") ? "up" : summary.includes("sell") ? "down" : "sideways";
  return {
    trend,
    rsi: snapshot?.rsi ?? null,
    signals: [snapshot?.summary, snapshot?.oscillators, snapshot?.movingAverages].filter(Boolean),
    source: "tradingview",
  };
}

export async function fetchTradingViewTechnicals(flags) {
  const symbol = String(flags.symbol || "").trim();
  if (!symbol) throw new Error("Missing required --symbol");
  const exchange = String(flags.exchange || "").trim();
  const port = getTradingViewPort(flags.port);
  const { client } = await connectTradingViewPage(port);

  try {
    await navigate(client, getTradingViewSymbolUrl(symbol, exchange), 5000);
    const snapshot = await evaluate(client, `
      (() => ({
        summary: document.body.innerText.match(/Summary\\s+(Strong Sell|Sell|Neutral|Buy|Strong Buy)/i)?.[1] || "",
        oscillators: document.body.innerText.match(/Oscillators\\s+(Strong Sell|Sell|Neutral|Buy|Strong Buy)/i)?.[1] || "",
        movingAverages: document.body.innerText.match(/Moving Averages\\s+(Strong Sell|Sell|Neutral|Buy|Strong Buy)/i)?.[1] || "",
      }))()
    `);
    return { ok: true, symbol: symbol.toUpperCase(), technicals: normalizeTradingViewTechnicals(snapshot) };
  } finally {
    await client.close();
  }
}

export async function runTradingViewTechnicals(flags) {
  const result = await fetchTradingViewTechnicals(flags);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}
```

- [ ] **Step 3.4: Export the new runner and merge it in `src/sites/market/technicals.mjs`**

```js
import { fetchTradingViewTechnicals } from "../tradingview/technicals.mjs";

export function mergeTechnicalsResults(succeeded) {
  const barchart = succeeded.find((entry) => entry.name === "barchart");
  const tradingview = succeeded.find((entry) => entry.name === "tradingview");

  const barchartNormalized = barchart ? toTechnicalsSchema(barchart.data) : null;
  const tradingviewNormalized = tradingview?.data?.ok ? tradingview.data.technicals : null;

  if (barchartNormalized && tradingviewNormalized) {
    if (barchartNormalized.trend !== tradingviewNormalized.trend) {
      return {
        trend: "sideways",
        rsi: barchartNormalized.rsi ?? tradingviewNormalized.rsi ?? null,
        signals: [...barchartNormalized.signals, ...tradingviewNormalized.signals],
        source: "barchart+tradingview",
      };
    }
    return {
      trend: barchartNormalized.trend,
      rsi: barchartNormalized.rsi ?? tradingviewNormalized.rsi ?? null,
      signals: [...barchartNormalized.signals, ...tradingviewNormalized.signals],
      source: "barchart+tradingview",
    };
  }

  return barchartNormalized || tradingviewNormalized || null;
}
```

- [ ] **Step 3.5: Run the technical tests to verify they pass**

```bash
node --test test/tradingview-technicals.test.mjs test/market-technicals.test.mjs
```

Expected: PASS with TradingView normalization and sideways tie handling covered.

- [ ] **Step 3.6: Commit**

```bash
git add src/sites/tradingview/technicals.mjs src/sites/tradingview/index.mjs src/sites/market/technicals.mjs test/tradingview-technicals.test.mjs test/market-technicals.test.mjs
git commit -m "feat: merge tradingview technicals into market technicals"
```

---

## Task 4: Tighten Sentiment Semantics

**Files:**
- Modify: `src/sites/xueqiu/symbol-sentiment.mjs`
- Modify: `src/sites/market/sentiment.mjs`
- Modify: `test/market-sentiment.test.mjs`

- [ ] **Step 4.1: Add failing tests for `mentions` and `hot_rank` behavior**

```js
test("mergeSentimentResults sums mentions across xueqiu, weibo, zhihu, and reddit", () => {
  const result = mergeSentimentResults([
    { name: "xueqiu", data: { ok: true, discussions: 12, hotRank: 5 } },
    { name: "weibo", data: { ok: true, count: 7 } },
    { name: "zhihu", data: { ok: true, count: 3 } },
    { name: "reddit", data: { ok: true, count: 9 } },
  ], "NVDA");

  assert.equal(result.mentions, 31);
  assert.equal(result.hot_rank, 5);
});

test("mergeSentimentResults does not use follower count as hot_rank", () => {
  const result = mergeSentimentResults([
    { name: "xueqiu", data: { ok: true, followers: "20.5万", discussions: 8, hotRank: null } },
  ], "NVDA");

  assert.equal(result.hot_rank, null);
  assert.equal(result.mentions, 8);
});
```

- [ ] **Step 4.2: Run the sentiment tests to verify they fail**

```bash
node --test test/market-sentiment.test.mjs
```

Expected: FAIL because the current merge logic uses `followers` as `hot_rank` and does not add Xueqiu discussions to `mentions`.

- [ ] **Step 4.3: Normalize Xueqiu semantics in `src/sites/xueqiu/symbol-sentiment.mjs`**

```js
return {
  ok: true,
  symbol,
  source: "xueqiu",
  followers: data.followers ?? null,
  discussions: Number(String(data.discussions ?? "").replace(/[^\d.]/g, "")) || 0,
  hotRank: data.hotRank ?? null,
  score: 0,
};
```

- [ ] **Step 4.4: Update `mergeSentimentResults()` to use discussions and explicit hot rank**

```js
export function mergeSentimentResults(succeeded) {
  let mentions = 0;
  let hotRank = null;
  const sources = [];

  for (const { name, data } of succeeded) {
    if (!data?.ok) continue;
    sources.push(name);

    if (name === "xueqiu") {
      mentions += Number(data.discussions ?? 0);
      hotRank = data.hotRank ?? hotRank;
      continue;
    }

    mentions += Number(data.count ?? 0);
  }

  return { score: 0, hot_rank: hotRank, mentions, sources };
}
```

- [ ] **Step 4.5: Run the sentiment tests to verify they pass**

```bash
node --test test/market-sentiment.test.mjs
```

Expected: PASS with corrected `mentions` and `hot_rank` semantics.

- [ ] **Step 4.6: Commit**

```bash
git add src/sites/xueqiu/symbol-sentiment.mjs src/sites/market/sentiment.mjs test/market-sentiment.test.mjs
git commit -m "feat: tighten market sentiment source normalization"
```

---

## Task 5: Expand Thesis Flags And Preserve Aggregate Meta

**Files:**
- Modify: `src/sites/market/thesis.mjs`
- Modify: `test/market-thesis.test.mjs`

- [ ] **Step 5.1: Add failing tests for extreme ratio, vol-skew, and elapsed timing**

```js
test("buildFlags detects extreme put-call ratio", () => {
  const flags = buildFlags([], { putCallRatio: 1.45, volSkewMaxAbs: null });
  assert.ok(flags.some((flag) => flag.includes("extreme put/call")));
});

test("buildFlags detects high vol-skew divergence", () => {
  const flags = buildFlags([], { putCallRatio: null, volSkewMaxAbs: 0.18 });
  assert.ok(flags.some((flag) => flag.includes("vol-skew")));
});

test("buildThesis preserves elapsedMs in meta", () => {
  const result = buildThesis({
    symbol: "NVDA",
    flow: null,
    quote: null,
    technicals: null,
    sentiment: null,
    meta: { sources_ok: [], sources_skipped: [], elapsedMs: 1234, command: "market thesis" },
  });
  assert.equal(result.meta.elapsedMs, 1234);
});
```

- [ ] **Step 5.2: Run the thesis tests to verify they fail**

```bash
node --test test/market-thesis.test.mjs
```

Expected: FAIL because `buildFlags()` only reads trades and `fetchMarketThesis()` does not currently set aggregate elapsed timing.

- [ ] **Step 5.3: Expand the thesis flag builder and meta handling**

```js
export function buildFlags(trades, signals = {}) {
  const flags = [];

  for (const trade of trades) {
    if (trade.expiry) {
      const dte = Math.round((new Date(trade.expiry).getTime() - Date.now()) / 86400000);
      if (dte >= 0 && dte <= 5) {
        flags.push(`near-expiry spike: ${trade.ticker} ${trade.side} exp ${trade.expiry}`);
      }
    }

    if (trade.premiumValue != null && trade.premiumValue >= 5_000_000) {
      flags.push(`large-premium: ${trade.ticker} ${trade.side} $${(trade.premiumValue / 1_000_000).toFixed(1)}M`);
    }
  }

  if (signals.putCallRatio != null && (signals.putCallRatio < 0.7 || signals.putCallRatio > 1.3)) {
    flags.push(`extreme put/call ratio: ${signals.putCallRatio}`);
  }

  if (signals.volSkewMaxAbs != null && signals.volSkewMaxAbs >= 0.1) {
    flags.push(`high vol-skew divergence: ${signals.volSkewMaxAbs}`);
  }

  return flags;
}

export function buildThesis({ symbol, flow, quote, technicals, sentiment, meta }) {
  const volSkewMaxAbs = Array.isArray(flow?.vol_skew)
    ? flow.vol_skew.reduce((acc, row) => Math.max(acc, Math.abs(Number(row?.skew) || 0)), 0)
    : null;

  const flags = buildFlags(flow?.notable_trades ?? [], {
    putCallRatio: flow?.put_call_ratio ?? null,
    volSkewMaxAbs,
  });

  return {
    ok: true,
    symbol,
    quote: quote ?? null,
    flow: flow ?? null,
    technicals: technicals ?? null,
    sentiment: sentiment ?? null,
    thesis: { bias, confidence, summary, flags },
    meta: {
      sources_ok: meta?.sources_ok ?? [],
      sources_skipped: meta?.sources_skipped ?? [],
      elapsedMs: meta?.elapsedMs ?? 0,
      command: "market thesis",
    },
  };
}
```

- [ ] **Step 5.4: Measure aggregate elapsed time in `fetchMarketThesis()`**

```js
export async function fetchMarketThesis(flags) {
  const startedAt = Date.now();
  const symbol = String(flags.symbol || "").trim().toUpperCase();
  if (!symbol) throw new Error("Missing required --symbol");
  const childFlags = { ...flags, symbol };
  const [flowResult, quoteResult, technicalsResult, sentimentResult] = await Promise.allSettled([
    fetchMarketFlow(childFlags),
    fetchMarketQuote(childFlags),
    fetchMarketTechnicals(childFlags),
    fetchMarketSentiment(childFlags),
  ]);

  const allSourcesOk = [];
  const allSourcesSkipped = [];
  const pickDimension = (result, key) => {
    if (result.status !== "fulfilled" || !result.value?.ok) return null;
    allSourcesOk.push(...(result.value.meta?.sources_ok ?? []));
    allSourcesSkipped.push(...(result.value.meta?.sources_skipped ?? []));
    return result.value[key] ?? null;
  };

  return buildThesis({
    symbol,
    flow: pickDimension(flowResult, "flow"),
    quote: pickDimension(quoteResult, "quote"),
    technicals: pickDimension(technicalsResult, "technicals"),
    sentiment: pickDimension(sentimentResult, "sentiment"),
    meta: {
      sources_ok: allSourcesOk,
      sources_skipped: allSourcesSkipped,
      elapsedMs: Date.now() - startedAt,
      command: "market thesis",
    },
  });
}
```

- [ ] **Step 5.5: Run the thesis tests to verify they pass**

```bash
node --test test/market-thesis.test.mjs
```

Expected: PASS with new flag coverage and timing metadata preserved.

- [ ] **Step 5.6: Commit**

```bash
git add src/sites/market/thesis.mjs test/market-thesis.test.mjs
git commit -m "feat: expand thesis flags and preserve aggregate timing"
```

---

## Task 6: Wire Vol-Skew Into Thesis And Add CLI Smoke Coverage

**Files:**
- Modify: `src/sites/market/flow.mjs`
- Modify: `src/sites/market/thesis.mjs`
- Modify: `src/command-registrations.mjs`
- Create: `test/market-cli-smoke.test.mjs`

- [ ] **Step 6.1: Write failing smoke tests for stable envelopes**

```js
// test/market-cli-smoke.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { mergeFlowResults } from "../src/sites/market/flow.mjs";
import { buildThesis } from "../src/sites/market/thesis.mjs";

test("market thesis envelope always includes ok, symbol, thesis, and meta", () => {
  const result = buildThesis({
    symbol: "NVDA",
    flow: { net_sentiment: "neutral", put_call_ratio: null, notable_trades: [], vol_skew: [], sources: [] },
    quote: null,
    technicals: null,
    sentiment: null,
    meta: { sources_ok: [], sources_skipped: ["barchart"], elapsedMs: 50, command: "market thesis" },
  });

  assert.equal(result.ok, true);
  assert.equal(result.symbol, "NVDA");
  assert.ok(result.thesis);
  assert.ok(result.meta);
});

test("mergeFlowResults copies vol-skew rows into the flow payload", () => {
  const result = mergeFlowResults([
    {
      name: "barchart-vol-skew",
      data: {
        ok: true,
        items: [{ strike: 100, callIV: 0.2, putIV: 0.34, skew: 0.14 }],
      },
    },
  ]);

  assert.deepEqual(result.vol_skew, [{ strike: 100, callIV: 0.2, putIV: 0.34, skew: 0.14 }]);
});
```

- [ ] **Step 6.2: Run the smoke tests to verify they fail if the envelope is incomplete**

```bash
node --test test/market-cli-smoke.test.mjs
```

Expected: FAIL because `mergeFlowResults()` does not yet copy the `barchart-vol-skew` source into `flow.vol_skew`.

- [ ] **Step 6.3: Attach vol-skew data to `market flow`**

```js
import { fetchBarchartVolSkew } from "../barchart/vol-skew.mjs";

export function mergeFlowResults(succeeded) {
  let volSkew = [];

  for (const { name, data } of succeeded) {
    if (name === "barchart-vol-skew" && data?.ok) {
      volSkew = Array.isArray(data.items) ? data.items : [];
      continue;
    }
    // Keep the other merge branches here.
  }

  return {
    net_sentiment: netSentiment,
    put_call_ratio: putCallRatio,
    notable_trades: notableTrades,
    vol_skew: volSkew,
    sources: succeeded.map((s) => s.name),
  };
}
```

- [ ] **Step 6.4: Add the vol-skew source to the aggregate source list**

```js
{ name: "barchart-vol-skew", fetch: () => fetchBarchartVolSkew({ symbol, port, limit: 20 }) },
```

- [ ] **Step 6.5: Run the focused market test suite**

```bash
node --test test/barchart-option-signals.test.mjs test/market-flow.test.mjs test/tradingview-technicals.test.mjs test/market-technicals.test.mjs test/market-sentiment.test.mjs test/market-thesis.test.mjs test/market-cli-smoke.test.mjs
```

Expected: PASS with all targeted market revision tests green.

- [ ] **Step 6.6: Run CLI smoke commands in the shared browser path**

```bash
node src/cli.mjs browser ensure --port 9223
node src/cli.mjs market quote --symbol NVDA --quick --port 9223
node src/cli.mjs market flow --symbol NVDA --quick --port 9223
node src/cli.mjs market technicals --symbol NVDA --quick --port 9223
node src/cli.mjs market sentiment --symbol NVDA --quick --port 9223
node src/cli.mjs market thesis --symbol NVDA --quick --port 9223
```

Expected:
- Each command prints valid JSON
- `meta.command` matches the command invoked
- Partial source failures appear in `meta.sources_skipped`
- `market thesis` still returns `bias`, `confidence`, `summary`, and `flags`

- [ ] **Step 6.7: Commit**

```bash
git add src/sites/market/flow.mjs src/sites/market/thesis.mjs src/command-registrations.mjs test/market-cli-smoke.test.mjs
git commit -m "feat: complete market thesis revision integration"
```

---

## Self-Review

### Spec coverage

- Shared envelope and metadata consistency: covered by Tasks 2, 5, and 6
- `flow.put_call_ratio`: covered by Tasks 1 and 2
- `technicals.trend` merge with TradingView: covered by Task 3
- `sentiment.mentions` and `hot_rank` semantics: covered by Task 4
- Extreme put/call and vol-skew thesis flags: covered by Tasks 5 and 6
- Quick-mode and degradation behavior: covered by Tasks 2, 5, and 6

### Placeholder scan

- No `TODO`, `TBD`, or "implement later" placeholders remain in the plan
- Every task includes exact files, commands, and concrete code snippets

### Type consistency

- `put_call_ratio`, `vol_skew`, `hot_rank`, `mentions`, `signals`, and `elapsedMs` use one spelling throughout
- TradingView technical normalization is referenced consistently as `normalizeTradingViewTechnicals`
