# Market Thesis Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `market` command族 (flow, quote, technicals, sentiment, thesis) that aggregates data from multiple existing finance sites into a unified, structured analysis usable both manually and by AI agents.

**Architecture:** A new `src/core/market-aggregator.mjs` runs sources concurrently with timeout-based degradation. Each `src/sites/market/<dimension>.mjs` calls the aggregator with its sources and a merge function. The `thesis` command calls all four dimensions and applies a rule-based engine. Existing site files gain small adapter exports (`toFlowTrades`, `toTechnicalsSchema`) — their core logic is untouched.

**Tech Stack:** Node.js ESM, `node:test` + `node:assert/strict`, CDP via existing `src/core/cdp.mjs`, existing site fetch functions.

**Spec:** `docs/superpowers/specs/2026-04-13-market-thesis-engine-design.md`

---

## File Map

### New files
| File | Responsibility |
|---|---|
| `src/core/market-aggregator.mjs` | Concurrent multi-source fetcher with timeout + graceful degradation |
| `src/sites/market/index.mjs` | Register all `market` commands |
| `src/sites/market/flow.mjs` | Aggregate flow from barchart + unusual-whales + whalestream |
| `src/sites/market/quote.mjs` | Unified quote: barchart primary, yahoo-finance fallback |
| `src/sites/market/technicals.mjs` | Aggregate technicals from barchart + tradingview |
| `src/sites/market/sentiment.mjs` | Aggregate sentiment from xueqiu + weibo + zhihu + reddit |
| `src/sites/market/thesis.mjs` | Rule engine: bias vote → confidence → flags → summary |
| `src/sites/barchart/vol-skew.mjs` | New barchart vol-skew command |
| `src/sites/xueqiu/search.mjs` | New xueqiu symbol search command |
| `src/sites/xueqiu/symbol-sentiment.mjs` | New xueqiu symbol hot-rank/mention query |
| `src/sites/weibo/search.mjs` | New weibo keyword search |
| `src/sites/zhihu/search.mjs` | New zhihu keyword search |
| `src/sites/reddit/search.mjs` | New reddit symbol search |

### Modified files
| File | Change |
|---|---|
| `src/sites/unusual-whales/flow.mjs` | Add `toFlowTrades(data)` adapter export |
| `src/sites/whalestream/summary.mjs` | Add `toFlowTrades(data)` adapter export |
| `src/sites/barchart/technicals.mjs` | Add `toTechnicalsSchema(data)` adapter export |
| `src/command-registrations.mjs` | Register all new commands |

### New test files
| File | Tests |
|---|---|
| `test/market-aggregator.test.mjs` | aggregate() with mocked sources |
| `test/market-flow.test.mjs` | mergeFlowResults(), toFlowTrades() adapters |
| `test/market-quote.test.mjs` | mergeQuoteResults(), fallback logic |
| `test/market-technicals.test.mjs` | mergeTechnicalsResults(), toTechnicalsSchema() |
| `test/market-sentiment.test.mjs` | mergeSentimentResults(), per-source normalizers |
| `test/market-thesis.test.mjs` | computeBias(), computeConfidence(), buildThesis() |
| `test/barchart-vol-skew.test.mjs` | parseVolSkew() parser |
| `test/xueqiu-search.test.mjs` | parseXueqiuSearch() parser |

---

## Phase 1: Core Aggregator + Market Flow

---

### Task 1: `src/core/market-aggregator.mjs`

**Files:**
- Create: `src/core/market-aggregator.mjs`
- Create: `test/market-aggregator.test.mjs`

- [ ] **Step 1.1: Write the failing test**

```js
// test/market-aggregator.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { aggregate } from "../src/core/market-aggregator.mjs";

test("aggregate resolves all sources that succeed", async () => {
  const result = await aggregate({
    sources: [
      { name: "a", fetch: async () => ({ value: 1 }) },
      { name: "b", fetch: async () => ({ value: 2 }) },
    ],
    merge: (succeeded) => succeeded.map((s) => s.data),
  });
  assert.deepEqual(result.meta.sources_ok, ["a", "b"]);
  assert.deepEqual(result.meta.sources_skipped, []);
  assert.deepEqual(result.data, [{ value: 1 }, { value: 2 }]);
  assert.ok(typeof result.meta.elapsedMs === "number");
});

test("aggregate skips sources that throw", async () => {
  const result = await aggregate({
    sources: [
      { name: "good", fetch: async () => ({ value: 42 }) },
      { name: "bad", fetch: async () => { throw new Error("network fail"); } },
    ],
    merge: (succeeded) => succeeded.map((s) => s.data),
  });
  assert.deepEqual(result.meta.sources_ok, ["good"]);
  assert.deepEqual(result.meta.sources_skipped, ["bad"]);
  assert.deepEqual(result.data, [{ value: 42 }]);
});

test("aggregate skips sources that exceed timeoutMs", async () => {
  const result = await aggregate({
    sources: [
      { name: "fast", fetch: async () => ({ value: 1 }) },
      { name: "slow", fetch: () => new Promise((resolve) => setTimeout(() => resolve({ value: 2 }), 200)) },
    ],
    timeoutMs: 50,
    merge: (succeeded) => succeeded.map((s) => s.data),
  });
  assert.deepEqual(result.meta.sources_ok, ["fast"]);
  assert.deepEqual(result.meta.sources_skipped, ["slow"]);
});

test("aggregate returns empty data when all sources fail", async () => {
  const result = await aggregate({
    sources: [
      { name: "a", fetch: async () => { throw new Error("fail"); } },
    ],
    merge: (succeeded) => succeeded,
  });
  assert.deepEqual(result.meta.sources_ok, []);
  assert.deepEqual(result.meta.sources_skipped, ["a"]);
  assert.deepEqual(result.data, []);
});
```

- [ ] **Step 1.2: Run test to verify it fails**

```bash
cd /c/Users/jimin/source/vibe_coding_project/web_pilot
node --test test/market-aggregator.test.mjs
```

Expected: `Error` — module not found.

- [ ] **Step 1.3: Implement `src/core/market-aggregator.mjs`**

```js
// src/core/market-aggregator.mjs

/**
 * Run a promise with a per-source timeout. Returns the promise result if it
 * resolves within ms, otherwise rejects with a timeout error.
 * @param {Promise<unknown>} promise
 * @param {number} ms  0 = no timeout
 * @returns {Promise<unknown>}
 */
function withTimeout(promise, ms) {
  if (!ms) return promise;
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms),
    ),
  ]);
}

/**
 * Fetch multiple sources concurrently. Sources that throw or time out are
 * recorded in meta.sources_skipped and do not block the result.
 *
 * @param {object} opts
 * @param {Array<{ name: string, fetch: () => Promise<unknown> }>} opts.sources
 * @param {number} [opts.timeoutMs]  Per-source timeout in ms; 0 = no timeout (default)
 * @param {(succeeded: Array<{ name: string, data: unknown }>) => unknown} opts.merge
 * @returns {Promise<{ data: unknown, meta: { sources_ok: string[], sources_skipped: string[], elapsedMs: number } }>}
 */
export async function aggregate({ sources, timeoutMs = 0, merge }) {
  const start = Date.now();

  const settled = await Promise.allSettled(
    sources.map(({ name, fetch: fetchFn }) =>
      withTimeout(fetchFn(), timeoutMs).then((data) => ({ name, data })),
    ),
  );

  const sourcesOk = [];
  const sourcesSkipped = [];
  const succeeded = [];

  for (let i = 0; i < settled.length; i += 1) {
    const { name } = sources[i];
    const result = settled[i];
    if (result.status === "fulfilled") {
      sourcesOk.push(name);
      succeeded.push(result.value);
    } else {
      sourcesSkipped.push(name);
    }
  }

  return {
    data: merge(succeeded),
    meta: {
      sources_ok: sourcesOk,
      sources_skipped: sourcesSkipped,
      elapsedMs: Date.now() - start,
    },
  };
}
```

- [ ] **Step 1.4: Run tests to verify they pass**

```bash
node --test test/market-aggregator.test.mjs
```

Expected: 4 tests pass.

- [ ] **Step 1.5: Commit**

```bash
git add src/core/market-aggregator.mjs test/market-aggregator.test.mjs
git commit -m "feat: add market-aggregator core helper with timeout and degradation"
```

---

### Task 2: Flow trade normalizers on existing sites

**Files:**
- Modify: `src/sites/unusual-whales/flow.mjs`
- Modify: `src/sites/whalestream/summary.mjs`
- Create: `test/market-flow.test.mjs` (started here, extended in Task 3)

- [ ] **Step 2.1: Write failing tests for flow trade normalizers**

```js
// test/market-flow.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { toFlowTrades as uwToFlowTrades } from "../src/sites/unusual-whales/flow.mjs";
import { toFlowTrades as wsToFlowTrades } from "../src/sites/whalestream/summary.mjs";

test("unusual-whales toFlowTrades maps items to normalized trades", () => {
  const input = {
    ok: true,
    items: [
      {
        ticker: "NVDA",
        side: "call",
        sentiment: "bullish",
        premiumValue: 1200000,
        premium: "$1.20M",
        strike: 950,
        expiry: "2026-05-16",
        size: 100,
      },
    ],
  };
  const result = uwToFlowTrades(input);
  assert.equal(result.length, 1);
  assert.equal(result[0].ticker, "NVDA");
  assert.equal(result[0].side, "call");
  assert.equal(result[0].sentiment, "bullish");
  assert.equal(result[0].premiumValue, 1200000);
  assert.equal(result[0].source, "unusual-whales");
});

test("unusual-whales toFlowTrades returns [] for non-ok input", () => {
  assert.deepEqual(uwToFlowTrades({ ok: false }), []);
  assert.deepEqual(uwToFlowTrades(null), []);
});

test("whalestream toFlowTrades maps topOptionsFlow items", () => {
  const input = {
    ok: true,
    topOptionsFlow: [
      { ticker: "AAPL", premium: "$2.50M", orders: "15", contracts: "500" },
    ],
  };
  const result = wsToFlowTrades(input);
  assert.equal(result.length, 1);
  assert.equal(result[0].ticker, "AAPL");
  assert.equal(result[0].premium, "$2.50M");
  assert.equal(result[0].source, "whalestream");
});

test("whalestream toFlowTrades returns [] for non-ok input", () => {
  assert.deepEqual(wsToFlowTrades({ ok: false }), []);
  assert.deepEqual(wsToFlowTrades(null), []);
});
```

- [ ] **Step 2.2: Run test to verify it fails**

```bash
node --test test/market-flow.test.mjs
```

Expected: Error — `toFlowTrades` is not exported.

- [ ] **Step 2.3: Add `toFlowTrades` to `src/sites/unusual-whales/flow.mjs`**

Add at the bottom of the file (after the existing `runUnusualWhalesFlow` export):

```js
/**
 * Normalize unusual-whales flow fetch result to the shared flow trade schema.
 * @param {object|null} data  Return value of fetchUnusualWhalesFlow()
 * @returns {Array<{ ticker, side, sentiment, premiumValue, premium, strike, expiry, size, source }>}
 */
export function toFlowTrades(data) {
  if (!data?.ok || !Array.isArray(data.items)) return [];
  return data.items.map((item) => ({
    ticker: item.ticker ?? null,
    side: item.side ?? null,
    sentiment: item.sentiment ?? null,
    premiumValue: item.premiumValue ?? null,
    premium: item.premium ?? null,
    strike: item.strike ?? null,
    expiry: item.expiry ?? null,
    size: item.size ?? null,
    source: "unusual-whales",
  }));
}
```

- [ ] **Step 2.4: Add `toFlowTrades` to `src/sites/whalestream/summary.mjs`**

Add at the bottom of the file (after `runWhaleStreamSummary`):

```js
/**
 * Normalize whalestream summary fetch result to the shared flow trade schema.
 * Whalestream topOptionsFlow items lack side/strike/expiry — those fields are null.
 * @param {object|null} data  Return value of fetchWhaleStreamSummary()
 * @returns {Array<{ ticker, side, sentiment, premiumValue, premium, strike, expiry, size, source }>}
 */
export function toFlowTrades(data) {
  if (!data?.ok || !Array.isArray(data.topOptionsFlow)) return [];
  return data.topOptionsFlow.map((item) => ({
    ticker: item.ticker ?? null,
    side: null,
    sentiment: null,
    premiumValue: null,
    premium: item.premium ?? null,
    strike: null,
    expiry: null,
    size: null,
    source: "whalestream",
  }));
}
```

- [ ] **Step 2.5: Run tests to verify they pass**

```bash
node --test test/market-flow.test.mjs
```

Expected: 4 tests pass.

- [ ] **Step 2.6: Commit**

```bash
git add src/sites/unusual-whales/flow.mjs src/sites/whalestream/summary.mjs test/market-flow.test.mjs
git commit -m "feat: add toFlowTrades adapters to unusual-whales and whalestream"
```

---

### Task 3: `src/sites/market/flow.mjs` + command registration

**Files:**
- Create: `src/sites/market/flow.mjs`
- Create: `src/sites/market/index.mjs`
- Modify: `src/command-registrations.mjs`
- Modify: `test/market-flow.test.mjs`

- [ ] **Step 3.1: Add mergeFlowResults tests to `test/market-flow.test.mjs`**

Append to the existing test file:

```js
import { mergeFlowResults } from "../src/sites/market/flow.mjs";

test("mergeFlowResults produces bullish net_sentiment when most trades are bullish", () => {
  const succeeded = [
    {
      name: "unusual-whales",
      data: {
        ok: true,
        items: [
          { ticker: "NVDA", side: "call", sentiment: "bullish", premiumValue: 1000000, premium: "$1M", strike: 950, expiry: "2026-05-16", size: 50 },
          { ticker: "AAPL", side: "call", sentiment: "bullish", premiumValue: 800000, premium: "$800K", strike: 200, expiry: "2026-05-16", size: 40 },
          { ticker: "SPY", side: "put", sentiment: "bearish", premiumValue: 600000, premium: "$600K", strike: 540, expiry: "2026-04-17", size: 30 },
        ],
      },
    },
  ];
  const result = mergeFlowResults(succeeded);
  assert.equal(result.net_sentiment, "bullish");
  assert.equal(result.sources.length, 1);
  assert.equal(result.notable_trades.length, 3);
});

test("mergeFlowResults returns neutral when no trades", () => {
  const result = mergeFlowResults([]);
  assert.equal(result.net_sentiment, "neutral");
  assert.deepEqual(result.notable_trades, []);
  assert.deepEqual(result.sources, []);
});

test("mergeFlowResults limits notable_trades to top 5 by premiumValue", () => {
  const items = Array.from({ length: 10 }, (_, i) => ({
    ticker: `SYM${i}`,
    side: "call",
    sentiment: "bullish",
    premiumValue: (10 - i) * 100000,
    premium: `$${(10 - i) * 100}K`,
    strike: 100,
    expiry: "2026-05-16",
    size: 10,
  }));
  const succeeded = [{ name: "unusual-whales", data: { ok: true, items } }];
  const result = mergeFlowResults(succeeded);
  assert.equal(result.notable_trades.length, 5);
  assert.equal(result.notable_trades[0].ticker, "SYM0");
});
```

- [ ] **Step 3.2: Run tests to verify new ones fail**

```bash
node --test test/market-flow.test.mjs
```

Expected: 4 pass (from Task 2), 3 fail — `mergeFlowResults` not found.

- [ ] **Step 3.3: Create `src/sites/market/flow.mjs`**

```js
// src/sites/market/flow.mjs
import { aggregate } from "../../core/market-aggregator.mjs";
import { fetchBarchartFlowSymbol } from "../barchart/flow-symbol.mjs";
import { fetchUnusualWhalesFlow, toFlowTrades as uwToFlowTrades } from "../unusual-whales/flow.mjs";
import { fetchWhaleStreamSummary, toFlowTrades as wsToFlowTrades } from "../whalestream/summary.mjs";

/**
 * Merge flow results from multiple sources into the unified flow schema.
 * @param {Array<{ name: string, data: unknown }>} succeeded
 * @returns {{ net_sentiment: string, put_call_ratio: number|null, notable_trades: unknown[], sources: string[] }}
 */
export function mergeFlowResults(succeeded) {
  const allTrades = [];
  for (const { name, data } of succeeded) {
    if (name === "unusual-whales") allTrades.push(...uwToFlowTrades(data));
    else if (name === "whalestream") allTrades.push(...wsToFlowTrades(data));
    else if (name === "barchart" && data?.ok && Array.isArray(data.items)) {
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

  const counts = { bullish: 0, bearish: 0, neutral: 0 };
  for (const trade of allTrades) {
    if (trade.sentiment === "bullish") counts.bullish += 1;
    else if (trade.sentiment === "bearish") counts.bearish += 1;
    else counts.neutral += 1;
  }

  let netSentiment = "neutral";
  if (counts.bullish > counts.bearish && counts.bullish > counts.neutral) {
    netSentiment = "bullish";
  } else if (counts.bearish > counts.bullish && counts.bearish > counts.neutral) {
    netSentiment = "bearish";
  }

  const notableTrades = allTrades
    .filter((t) => t.premiumValue != null)
    .sort((a, b) => (b.premiumValue ?? 0) - (a.premiumValue ?? 0))
    .slice(0, 5);

  return {
    net_sentiment: netSentiment,
    put_call_ratio: null, // populated separately by barchart put-call-ratio if available
    notable_trades: notableTrades,
    sources: succeeded.map((s) => s.name),
  };
}

/**
 * Fetch aggregated options flow for a symbol from multiple sources.
 * @param {object} flags  { symbol, port, quick }
 */
export async function fetchMarketFlow(flags) {
  const symbol = String(flags.symbol || "").trim().toUpperCase();
  if (!symbol) throw new Error("Missing required --symbol");
  const timeoutMs = flags.quick ? 4000 : 0;
  const port = flags.port;

  const { data: flow, meta } = await aggregate({
    sources: [
      { name: "barchart", fetch: () => fetchBarchartFlowSymbol({ symbol, port }) },
      { name: "unusual-whales", fetch: () => fetchUnusualWhalesFlow({ port, limit: 30 }) },
      { name: "whalestream", fetch: () => fetchWhaleStreamSummary({ port }) },
    ],
    timeoutMs,
    merge: mergeFlowResults,
  });

  return {
    ok: true,
    symbol,
    flow,
    meta: { ...meta, command: "market flow" },
  };
}

export async function runMarketFlow(flags) {
  const result = await fetchMarketFlow(flags);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}
```

- [ ] **Step 3.4: Create `src/sites/market/index.mjs`**

```js
// src/sites/market/index.mjs
// Registration entry point — see command-registrations.mjs for the actual calls.
export { fetchMarketFlow, runMarketFlow } from "./flow.mjs";
```

- [ ] **Step 3.5: Run tests to verify they pass**

```bash
node --test test/market-flow.test.mjs
```

Expected: All 7 tests pass.

- [ ] **Step 3.6: Register market flow in `src/command-registrations.mjs`**

Find the block with `"market:scan"` registration (around line 398). Add after the `market:drilldown` registration block:

```js
  // ── market thesis engine ────────────────────────────────────────────────
  reg.register({
    site: "market", action: "flow", name: "market flow",
    category: "finance",
    description: "Aggregate options flow across barchart, unusual-whales, and whalestream",
    usage: "node src/cli.mjs market flow --symbol NVDA [--quick] [--port 9223]",
    handler: async (flags) => {
      const { runMarketFlow } = await import("./sites/market/flow.mjs");
      return runMarketFlow(flags);
    },
  });
```

Also add USAGE entry at the top of the USAGE object in `command-registrations.mjs`:

```js
  "market:flow":      "node src/cli.mjs market flow --symbol NVDA [--quick] [--port 9223]",
```

- [ ] **Step 3.7: Verify registration is listed**

```bash
node src/cli.mjs sites list | grep "market flow"
```

Expected: `market flow` appears in the output.

- [ ] **Step 3.8: Commit**

```bash
git add src/sites/market/flow.mjs src/sites/market/index.mjs src/command-registrations.mjs test/market-flow.test.mjs
git commit -m "feat: add market flow command aggregating barchart, unusual-whales, whalestream"
```

---

## Phase 2: Quote + Technicals

---

### Task 4: `src/sites/market/quote.mjs`

**Files:**
- Create: `src/sites/market/quote.mjs`
- Create: `test/market-quote.test.mjs`
- Modify: `src/sites/market/index.mjs`
- Modify: `src/command-registrations.mjs`

- [ ] **Step 4.1: Write failing tests**

```js
// test/market-quote.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { mergeQuoteResults } from "../src/sites/market/quote.mjs";

test("mergeQuoteResults picks barchart when available", () => {
  const succeeded = [
    { name: "barchart", data: { ok: true, symbol: "NVDA", lastPrice: 950.5, changePercent: 2.1, volume: 50000000 } },
    { name: "yahoo-finance", data: { ok: true, symbol: "NVDA", price: 951, changePercent: 2.2, volume: 49000000 } },
  ];
  const result = mergeQuoteResults(succeeded, "NVDA");
  assert.equal(result.source, "barchart");
  assert.equal(result.price, 950.5);
  assert.equal(result.change_pct, 2.1);
});

test("mergeQuoteResults falls back to yahoo-finance when barchart missing", () => {
  const succeeded = [
    { name: "yahoo-finance", data: { ok: true, symbol: "NVDA", price: 951, changePercent: 2.2, volume: 49000000 } },
  ];
  const result = mergeQuoteResults(succeeded, "NVDA");
  assert.equal(result.source, "yahoo-finance");
  assert.equal(result.price, 951);
});

test("mergeQuoteResults returns null when no sources succeed", () => {
  const result = mergeQuoteResults([], "NVDA");
  assert.equal(result, null);
});
```

- [ ] **Step 4.2: Run test to verify it fails**

```bash
node --test test/market-quote.test.mjs
```

Expected: Error — `mergeQuoteResults` not found.

- [ ] **Step 4.3: Create `src/sites/market/quote.mjs`**

```js
// src/sites/market/quote.mjs
import { aggregate } from "../../core/market-aggregator.mjs";
import { fetchBarchartQuote } from "../barchart/quote.mjs";
import { fetchYahooFinanceQuote } from "../yahoo-finance/quote.mjs";

/**
 * Normalize raw site quote data to the unified quote schema.
 * barchart returns: { lastPrice, changePercent, volume }
 * yahoo-finance returns: { price, changePercent, volume }
 */
function normalizeQuote(name, data) {
  if (!data?.ok) return null;
  if (name === "barchart") {
    return {
      price: data.lastPrice ?? null,
      change_pct: data.changePercent ?? null,
      volume: data.volume ?? null,
      source: "barchart",
    };
  }
  if (name === "yahoo-finance") {
    return {
      price: data.price ?? null,
      change_pct: data.changePercent ?? null,
      volume: data.volume ?? null,
      source: "yahoo-finance",
    };
  }
  return null;
}

/**
 * Pick the best available quote from succeeded sources (barchart preferred).
 * @param {Array<{ name: string, data: unknown }>} succeeded
 * @param {string} symbol
 * @returns {{ price, change_pct, volume, source } | null}
 */
export function mergeQuoteResults(succeeded, symbol) {
  const priority = ["barchart", "yahoo-finance"];
  for (const preferred of priority) {
    const entry = succeeded.find((s) => s.name === preferred);
    if (entry) {
      const normalized = normalizeQuote(preferred, entry.data);
      if (normalized) return normalized;
    }
  }
  return null;
}

export async function fetchMarketQuote(flags) {
  const symbol = String(flags.symbol || "").trim().toUpperCase();
  if (!symbol) throw new Error("Missing required --symbol");
  const timeoutMs = flags.quick ? 4000 : 0;
  const port = flags.port;

  const { data: quote, meta } = await aggregate({
    sources: [
      { name: "barchart", fetch: () => fetchBarchartQuote({ symbol, port }) },
      { name: "yahoo-finance", fetch: () => fetchYahooFinanceQuote({ symbol, port }) },
    ],
    timeoutMs,
    merge: (succeeded) => mergeQuoteResults(succeeded, symbol),
  });

  return {
    ok: true,
    symbol,
    quote,
    meta: { ...meta, command: "market quote" },
  };
}

export async function runMarketQuote(flags) {
  const result = await fetchMarketQuote(flags);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}
```

- [ ] **Step 4.4: Check that `fetchYahooFinanceQuote` is the correct export name**

```bash
grep -n "^export" /c/Users/jimin/source/vibe_coding_project/web_pilot/src/sites/yahoo-finance/quote.mjs
```

If the export name differs, update the import in `quote.mjs` accordingly.

- [ ] **Step 4.5: Run tests to verify they pass**

```bash
node --test test/market-quote.test.mjs
```

Expected: 3 tests pass.

- [ ] **Step 4.6: Update `src/sites/market/index.mjs`**

```js
// src/sites/market/index.mjs
export { fetchMarketFlow, runMarketFlow } from "./flow.mjs";
export { fetchMarketQuote, runMarketQuote } from "./quote.mjs";
```

- [ ] **Step 4.7: Register in `src/command-registrations.mjs`**

After the `market:flow` registration block, add:

```js
  reg.register({
    site: "market", action: "quote", name: "market quote",
    category: "finance",
    description: "Unified quote: barchart primary, yahoo-finance fallback",
    usage: "node src/cli.mjs market quote --symbol NVDA [--quick] [--port 9223]",
    handler: async (flags) => {
      const { runMarketQuote } = await import("./sites/market/quote.mjs");
      return runMarketQuote(flags);
    },
  });
```

Add USAGE entry:

```js
  "market:quote": "node src/cli.mjs market quote --symbol NVDA [--quick] [--port 9223]",
```

- [ ] **Step 4.8: Commit**

```bash
git add src/sites/market/quote.mjs src/sites/market/index.mjs src/command-registrations.mjs test/market-quote.test.mjs
git commit -m "feat: add market quote command (barchart primary, yahoo-finance fallback)"
```

---

### Task 5: Normalize barchart technicals + `src/sites/market/technicals.mjs`

**Files:**
- Modify: `src/sites/barchart/technicals.mjs`
- Create: `src/sites/market/technicals.mjs`
- Create: `test/market-technicals.test.mjs`
- Modify: `src/sites/market/index.mjs`
- Modify: `src/command-registrations.mjs`

- [ ] **Step 5.1: Write failing tests**

```js
// test/market-technicals.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { toTechnicalsSchema } from "../src/sites/barchart/technicals.mjs";
import { mergeTechnicalsResults } from "../src/sites/market/technicals.mjs";

test("toTechnicalsSchema extracts trend from technicalRating", () => {
  const barchartData = {
    ok: true,
    symbol: "NVDA",
    technicalRating: "Strong Buy",
    ivRank: 45,
    supportLevels: [900, 880],
    resistanceLevels: [1000, 1050],
  };
  const result = toTechnicalsSchema(barchartData);
  assert.equal(result.trend, "up");
  assert.equal(result.source, "barchart");
  assert.ok(Array.isArray(result.signals));
});

test("toTechnicalsSchema maps bearish ratings to down trend", () => {
  const barchartData = { ok: true, symbol: "NVDA", technicalRating: "Sell", ivRank: 60 };
  const result = toTechnicalsSchema(barchartData);
  assert.equal(result.trend, "down");
});

test("toTechnicalsSchema returns null for non-ok data", () => {
  assert.equal(toTechnicalsSchema({ ok: false }), null);
  assert.equal(toTechnicalsSchema(null), null);
});

test("mergeTechnicalsResults picks barchart when available", () => {
  const succeeded = [
    {
      name: "barchart",
      data: { ok: true, symbol: "NVDA", technicalRating: "Buy", ivRank: 40, supportLevels: [], resistanceLevels: [] },
    },
  ];
  const result = mergeTechnicalsResults(succeeded);
  assert.equal(result.source, "barchart");
  assert.equal(result.trend, "up");
});

test("mergeTechnicalsResults returns null when no sources", () => {
  assert.equal(mergeTechnicalsResults([]), null);
});
```

- [ ] **Step 5.2: Run test to verify it fails**

```bash
node --test test/market-technicals.test.mjs
```

Expected: Error — `toTechnicalsSchema` not exported from barchart/technicals.mjs.

- [ ] **Step 5.3: Add `toTechnicalsSchema` to `src/sites/barchart/technicals.mjs`**

Add at the bottom of the existing file (after `runBarchartTechnicals`):

```js
const BULLISH_RATINGS = new Set(["strong buy", "buy"]);
const BEARISH_RATINGS = new Set(["sell", "strong sell"]);

/**
 * Normalize a fetchBarchartTechnicals() result to the unified technicals schema.
 * @param {object|null} data  Return value of fetchBarchartTechnicals()
 * @returns {{ trend, rsi, signals, source } | null}
 */
export function toTechnicalsSchema(data) {
  if (!data?.ok) return null;
  const rating = String(data.technicalRating || "").toLowerCase().trim();
  let trend = "sideways";
  if (BULLISH_RATINGS.has(rating)) trend = "up";
  else if (BEARISH_RATINGS.has(rating)) trend = "down";

  const signals = [];
  if (data.technicalRating) signals.push(data.technicalRating);
  if (data.ivRank != null) signals.push(`IV Rank ${data.ivRank}`);

  return {
    trend,
    rsi: null,    // barchart public pages do not expose RSI in parsed output
    signals,
    source: "barchart",
  };
}
```

- [ ] **Step 5.4: Create `src/sites/market/technicals.mjs`**

```js
// src/sites/market/technicals.mjs
import { aggregate } from "../../core/market-aggregator.mjs";
import { fetchBarchartTechnicals, toTechnicalsSchema } from "../barchart/technicals.mjs";

/**
 * Pick the best available technicals result (barchart preferred).
 * @param {Array<{ name: string, data: unknown }>} succeeded
 * @returns {{ trend, rsi, signals, source } | null}
 */
export function mergeTechnicalsResults(succeeded) {
  const priority = ["barchart"];
  for (const preferred of priority) {
    const entry = succeeded.find((s) => s.name === preferred);
    if (entry) {
      const normalized =
        preferred === "barchart" ? toTechnicalsSchema(entry.data) : null;
      if (normalized) return normalized;
    }
  }
  return null;
}

export async function fetchMarketTechnicals(flags) {
  const symbol = String(flags.symbol || "").trim().toUpperCase();
  if (!symbol) throw new Error("Missing required --symbol");
  const timeoutMs = flags.quick ? 4000 : 0;
  const port = flags.port;

  const { data: technicals, meta } = await aggregate({
    sources: [
      { name: "barchart", fetch: () => fetchBarchartTechnicals({ symbol, port }) },
    ],
    timeoutMs,
    merge: mergeTechnicalsResults,
  });

  return {
    ok: true,
    symbol,
    technicals,
    meta: { ...meta, command: "market technicals" },
  };
}

export async function runMarketTechnicals(flags) {
  const result = await fetchMarketTechnicals(flags);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}
```

- [ ] **Step 5.5: Run tests to verify they pass**

```bash
node --test test/market-technicals.test.mjs
```

Expected: 5 tests pass.

- [ ] **Step 5.6: Update `src/sites/market/index.mjs`**

```js
// src/sites/market/index.mjs
export { fetchMarketFlow, runMarketFlow } from "./flow.mjs";
export { fetchMarketQuote, runMarketQuote } from "./quote.mjs";
export { fetchMarketTechnicals, runMarketTechnicals } from "./technicals.mjs";
```

- [ ] **Step 5.7: Register in `src/command-registrations.mjs`**

After `market:quote` registration:

```js
  reg.register({
    site: "market", action: "technicals", name: "market technicals",
    category: "finance",
    description: "Technical signals for a symbol via barchart",
    usage: "node src/cli.mjs market technicals --symbol NVDA [--quick] [--port 9223]",
    handler: async (flags) => {
      const { runMarketTechnicals } = await import("./sites/market/technicals.mjs");
      return runMarketTechnicals(flags);
    },
  });
```

Add USAGE entry:

```js
  "market:technicals": "node src/cli.mjs market technicals --symbol NVDA [--quick] [--port 9223]",
```

- [ ] **Step 5.8: Commit**

```bash
git add src/sites/barchart/technicals.mjs src/sites/market/technicals.mjs src/sites/market/index.mjs src/command-registrations.mjs test/market-technicals.test.mjs
git commit -m "feat: add market technicals command and toTechnicalsSchema adapter"
```

---

## Phase 3: Site Command Additions

---

### Task 6: `src/sites/barchart/vol-skew.mjs`

**Files:**
- Create: `src/sites/barchart/vol-skew.mjs`
- Create: `test/barchart-vol-skew.test.mjs`
- Modify: `src/command-registrations.mjs`

- [ ] **Step 6.1: Write failing test**

```js
// test/barchart-vol-skew.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { parseVolSkew } from "../src/sites/barchart/vol-skew.mjs";

test("parseVolSkew extracts call and put IV from raw text", () => {
  const rawText = `
    Implied Volatility (Call) 35.50%
    Implied Volatility (Put)  40.20%
    Historical Volatility     28.00%
  `;
  const result = parseVolSkew(rawText, "NVDA");
  assert.equal(result.ok, true);
  assert.equal(result.symbol, "NVDA");
  assert.equal(result.callIv, 35.5);
  assert.equal(result.putIv, 40.2);
  assert.equal(result.skew, Number((40.2 - 35.5).toFixed(2)));
  assert.equal(result.bias, "put-skewed");
});

test("parseVolSkew returns call-skewed when call IV > put IV", () => {
  const rawText = `
    Implied Volatility (Call) 42.0%
    Implied Volatility (Put)  30.0%
  `;
  const result = parseVolSkew(rawText, "SPY");
  assert.equal(result.bias, "call-skewed");
  assert.equal(result.skew, Number((30.0 - 42.0).toFixed(2)));
});

test("parseVolSkew returns flat when IVs are within 1%", () => {
  const rawText = `
    Implied Volatility (Call) 30.0%
    Implied Volatility (Put)  30.4%
  `;
  const result = parseVolSkew(rawText, "QQQ");
  assert.equal(result.bias, "flat");
});

test("parseVolSkew handles missing data gracefully", () => {
  const result = parseVolSkew("No relevant data here", "XYZ");
  assert.equal(result.ok, true);
  assert.equal(result.callIv, null);
  assert.equal(result.putIv, null);
  assert.equal(result.skew, null);
  assert.equal(result.bias, null);
});
```

- [ ] **Step 6.2: Run test to verify it fails**

```bash
node --test test/barchart-vol-skew.test.mjs
```

Expected: Error — module not found.

- [ ] **Step 6.3: Create `src/sites/barchart/vol-skew.mjs`**

```js
// src/sites/barchart/vol-skew.mjs
import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectBarchartPage, getBarchartPort, getQuoteUrl } from "./common.mjs";

function extractIv(text, label) {
  const match = text.match(new RegExp(`${label}[\\s\\S]{0,20}?([0-9]+(?:\\.[0-9]+)?)%`, "i"));
  return match ? Number(match[1]) : null;
}

/**
 * Parse vol-skew fields from barchart page text.
 * Exported for unit testing without CDP.
 * @param {string} rawText
 * @param {string} symbol
 */
export function parseVolSkew(rawText, symbol) {
  const callIv = extractIv(rawText, "Implied Volatility \\(Call\\)");
  const putIv = extractIv(rawText, "Implied Volatility \\(Put\\)");

  let skew = null;
  let bias = null;

  if (callIv != null && putIv != null) {
    skew = Number((putIv - callIv).toFixed(2));
    if (Math.abs(skew) <= 1) bias = "flat";
    else if (skew > 0) bias = "put-skewed";
    else bias = "call-skewed";
  }

  return { ok: true, symbol, callIv, putIv, skew, bias };
}

export async function fetchBarchartVolSkew(flags) {
  const symbol = String(flags.symbol || "").trim().toUpperCase();
  if (!symbol) throw new Error("Missing required --symbol");
  const port = getBarchartPort(flags.port);
  let lastError = null;

  for (const fresh of [false, true]) {
    const { client } = await connectBarchartPage(symbol, port, { fresh });
    try {
      await navigate(client, getQuoteUrl(symbol), 4000);
      const { text } = await evaluate(client, `({ text: document.body.innerText || "" })`);
      return parseVolSkew(text, symbol);
    } catch (error) {
      lastError = error;
    } finally {
      await client.close();
    }
  }

  throw lastError;
}

export async function runBarchartVolSkew(flags) {
  const result = await fetchBarchartVolSkew(flags);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}
```

- [ ] **Step 6.4: Run tests to verify they pass**

```bash
node --test test/barchart-vol-skew.test.mjs
```

Expected: 4 tests pass.

- [ ] **Step 6.5: Register in `src/command-registrations.mjs`**

In the barchart block, after `barchart:put-call-ratio`:

```js
  registerSimple(reg, "barchart", "vol-skew", "./sites/barchart/vol-skew.mjs", "runBarchartVolSkew", { category: "finance" });
```

Add USAGE entry:

```js
  "barchart:vol-skew": "node src/cli.mjs barchart vol-skew --symbol NVDA [--port 9223]",
```

- [ ] **Step 6.6: Commit**

```bash
git add src/sites/barchart/vol-skew.mjs src/command-registrations.mjs test/barchart-vol-skew.test.mjs
git commit -m "feat: add barchart vol-skew command"
```

---

### Task 7: `src/sites/xueqiu/search.mjs`

**Files:**
- Create: `src/sites/xueqiu/search.mjs`
- Create: `test/xueqiu-search.test.mjs`
- Modify: `src/command-registrations.mjs`

- [ ] **Step 7.1: Inspect existing xueqiu site pattern**

```bash
ls /c/Users/jimin/source/vibe_coding_project/web_pilot/src/sites/xueqiu/
head -30 /c/Users/jimin/source/vibe_coding_project/web_pilot/src/sites/xueqiu/common.mjs
```

Note the connect/port helper names — use them exactly in the new file.

- [ ] **Step 7.2: Write failing test**

```js
// test/xueqiu-search.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { parseXueqiuSearch } from "../src/sites/xueqiu/search.mjs";

test("parseXueqiuSearch extracts stock results from API response", () => {
  const apiResponse = {
    data: {
      stocks: {
        items: [
          { symbol: "SH600519", name: "贵州茅台", current: 1800.0, chg: 0.5 },
          { symbol: "SH000001", name: "上证指数", current: 3200.0, chg: -0.3 },
        ],
      },
    },
  };
  const result = parseXueqiuSearch(apiResponse, "茅台");
  assert.equal(result.ok, true);
  assert.equal(result.count, 2);
  assert.equal(result.items[0].symbol, "SH600519");
  assert.equal(result.items[0].name, "贵州茅台");
  assert.equal(result.items[0].current, 1800.0);
});

test("parseXueqiuSearch returns empty items when no stocks found", () => {
  const apiResponse = { data: { stocks: { items: [] } } };
  const result = parseXueqiuSearch(apiResponse, "xyz");
  assert.equal(result.ok, true);
  assert.equal(result.count, 0);
  assert.deepEqual(result.items, []);
});

test("parseXueqiuSearch handles malformed response gracefully", () => {
  const result = parseXueqiuSearch(null, "test");
  assert.equal(result.ok, true);
  assert.equal(result.count, 0);
});
```

- [ ] **Step 7.3: Run test to verify it fails**

```bash
node --test test/xueqiu-search.test.mjs
```

Expected: Error — module not found.

- [ ] **Step 7.4: Create `src/sites/xueqiu/search.mjs`**

Look at `src/sites/xueqiu/common.mjs` to get the correct import names for `connectXueqiuPage` and `getXueqiuPort`, then write:

```js
// src/sites/xueqiu/search.mjs
import { getJsonResponseBody, navigate } from "../../core/cdp.mjs";
import { connectXueqiuPage, getXueqiuPort } from "./common.mjs";

/**
 * Parse xueqiu search API response into normalized items.
 * Exported for unit testing without CDP.
 */
export function parseXueqiuSearch(payload, query) {
  const items = payload?.data?.stocks?.items ?? [];
  const normalized = Array.isArray(items)
    ? items.map((item) => ({
        symbol: item.symbol ?? null,
        name: item.name ?? null,
        current: item.current ?? null,
        change_pct: item.chg ?? null,
      }))
    : [];
  return { ok: true, query, count: normalized.length, items: normalized };
}

export async function fetchXueqiuSearch(flags) {
  const query = String(flags.query || "").trim();
  if (!query) throw new Error("Missing required --query");
  const limit = Math.min(Number(flags.limit ?? 10), 30);
  const port = getXueqiuPort(flags.port);
  const { client } = await connectXueqiuPage(port);

  try {
    await client.send("Network.enable");
    const responsePromise = client.waitForEvent(
      "Network.responseReceived",
      (params) => String(params?.response?.url || "").includes("/v4/search/suggest_stock"),
      8000,
    );
    await navigate(client, `https://xueqiu.com/k?q=${encodeURIComponent(query)}`, 5000);
    const event = await responsePromise;
    const payload = await getJsonResponseBody(client, event.requestId);
    const result = parseXueqiuSearch(payload, query);
    return { ...result, items: result.items.slice(0, limit) };
  } finally {
    await client.close();
  }
}

export async function runXueqiuSearch(flags) {
  const result = await fetchXueqiuSearch(flags);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}
```

> **Note:** After creating the file, run a live test: `node src/cli.mjs xueqiu search --query 茅台 --port 9223`. If the API URL differs from `/v4/search/suggest_stock`, update the `waitForEvent` filter to match the actual network response URL seen in the browser's DevTools Network tab.

- [ ] **Step 7.5: Run unit tests to verify they pass**

```bash
node --test test/xueqiu-search.test.mjs
```

Expected: 3 tests pass.

- [ ] **Step 7.6: Register in `src/command-registrations.mjs`**

In the xueqiu block:

```js
  registerSimple(reg, "xueqiu", "search", "./sites/xueqiu/search.mjs", "runXueqiuSearch", { category: "finance" });
```

Add USAGE entry:

```js
  "xueqiu:search": "node src/cli.mjs xueqiu search --query <text> [--limit 10] [--port 9223]",
```

- [ ] **Step 7.7: Commit**

```bash
git add src/sites/xueqiu/search.mjs src/command-registrations.mjs test/xueqiu-search.test.mjs
git commit -m "feat: add xueqiu search command"
```

---

### Task 8: Yahoo Finance quote fallback parser

**Files:**
- Modify: `src/sites/yahoo-finance/quote.mjs` (add DOM-text fallback)

- [ ] **Step 8.1: Check current yahoo-finance quote exports**

```bash
grep -n "^export" /c/Users/jimin/source/vibe_coding_project/web_pilot/src/sites/yahoo-finance/quote.mjs
head -60 /c/Users/jimin/source/vibe_coding_project/web_pilot/src/sites/yahoo-finance/quote.mjs
```

Note the current parse strategy and which export name `fetchMarketQuote` should import.

- [ ] **Step 8.2: Add `parseFallback` and update `fetchYahooFinanceQuote`**

In `src/sites/yahoo-finance/quote.mjs`, find the primary JSON API parse path. After it, add a DOM-text fallback that fires when the API response is missing or malformed. The fallback uses `document.body.innerText` regex matching (same pattern as barchart/quote-helpers.mjs). Example insertion:

```js
// Add this helper near the top of the file, before fetchYahooFinanceQuote:
export function parseFallbackQuoteText(text, symbol) {
  const price = text.match(/([0-9,]+(?:\.[0-9]+)?)\s*(?:USD|[\+\-][0-9.]+\s*\()/)?.[1];
  const changeMatch = text.match(/([+\-][0-9.]+)\s*\(([+\-][0-9.]+)%\)/);
  return {
    ok: !!price,
    symbol,
    price: price ? Number(price.replace(/,/g, "")) : null,
    changePercent: changeMatch ? Number(changeMatch[2]) : null,
    volume: null,
    source: "yahoo-finance-fallback",
  };
}
```

Then in the catch/retry block of `fetchYahooFinanceQuote`, call `parseFallbackQuoteText` when the primary parse returns an empty price.

- [ ] **Step 8.3: Add a test for the fallback parser in `test/yahoo-quote.test.mjs`**

Append to the existing test file:

```js
import { parseFallbackQuoteText } from "../src/sites/yahoo-finance/quote.mjs";

test("parseFallbackQuoteText extracts price from body text", () => {
  const text = "NVDA 950.50 +15.00 (+1.60%) Volume: 45,000,000";
  const result = parseFallbackQuoteText(text, "NVDA");
  assert.equal(result.ok, true);
  assert.equal(result.price, 950.5);
});
```

- [ ] **Step 8.4: Run tests**

```bash
node --test test/yahoo-quote.test.mjs
```

Expected: All tests (existing + new) pass.

- [ ] **Step 8.5: Commit**

```bash
git add src/sites/yahoo-finance/quote.mjs test/yahoo-quote.test.mjs
git commit -m "feat: add yahoo-finance quote fallback DOM text parser"
```

---

## Phase 4: Sentiment + Thesis

---

### Task 9: Sentiment source commands

**Files:**
- Create: `src/sites/xueqiu/symbol-sentiment.mjs`
- Create: `src/sites/weibo/search.mjs`
- Create: `src/sites/zhihu/search.mjs`
- Create: `src/sites/reddit/search.mjs`
- Modify: `src/command-registrations.mjs`

- [ ] **Step 9.1: Check existing site patterns before creating files**

```bash
ls /c/Users/jimin/source/vibe_coding_project/web_pilot/src/sites/weibo/
ls /c/Users/jimin/source/vibe_coding_project/web_pilot/src/sites/zhihu/
ls /c/Users/jimin/source/vibe_coding_project/web_pilot/src/sites/reddit/
head -10 /c/Users/jimin/source/vibe_coding_project/web_pilot/src/sites/weibo/common.mjs
head -10 /c/Users/jimin/source/vibe_coding_project/web_pilot/src/sites/zhihu/common.mjs
head -10 /c/Users/jimin/source/vibe_coding_project/web_pilot/src/sites/reddit/common.mjs
```

Use the correct `connect*Page` and `get*Port` helper names from each site's `common.mjs`.

- [ ] **Step 9.2: Create `src/sites/xueqiu/symbol-sentiment.mjs`**

```js
// src/sites/xueqiu/symbol-sentiment.mjs
import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectXueqiuPage, getXueqiuPort } from "./common.mjs";

export async function fetchXueqiuSymbolSentiment(flags) {
  const symbol = String(flags.symbol || "").trim().toUpperCase();
  if (!symbol) throw new Error("Missing required --symbol");
  const port = getXueqiuPort(flags.port);
  const { client } = await connectXueqiuPage(port);

  try {
    await navigate(client, `https://xueqiu.com/S/${encodeURIComponent(symbol)}`, 5000);
    const data = await evaluate(client, `
      (() => {
        const text = document.body.innerText || "";
        const followersMatch = text.match(/([0-9,]+(?:\\.[0-9]+)?[万千]?)\\s*(?:关注者|followers)/i);
        const discussionMatch = text.match(/([0-9,]+)\\s*(?:条|讨论|discussion)/i);
        return {
          followers: followersMatch?.[1] || null,
          discussions: discussionMatch?.[1] || null,
          pageTitle: document.title,
        };
      })()
    `);
    return {
      ok: true,
      symbol,
      source: "xueqiu",
      followers: data.followers ?? null,
      discussions: data.discussions ?? null,
      score: 0,  // sentiment score computed in sentiment.mjs from mentions
    };
  } finally {
    await client.close();
  }
}

export async function runXueqiuSymbolSentiment(flags) {
  const result = await fetchXueqiuSymbolSentiment(flags);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}
```

- [ ] **Step 9.3: Create `src/sites/weibo/search.mjs`**

```js
// src/sites/weibo/search.mjs
import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectWeiboPage, getWeiboPort } from "./common.mjs";

export async function fetchWeiboSearch(flags) {
  const query = String(flags.query || flags.symbol || "").trim();
  if (!query) throw new Error("Missing required --query or --symbol");
  const limit = Math.min(Number(flags.limit ?? 10), 20);
  const port = getWeiboPort(flags.port);
  const { client } = await connectWeiboPage(port);

  try {
    await navigate(client, `https://s.weibo.com/weibo?q=${encodeURIComponent(query)}&rd=realtime`, 6000);
    const data = await evaluate(client, `
      (() => {
        const cards = [...document.querySelectorAll('.card-wrap')].slice(0, ${limit});
        return cards.map((card) => {
          const text = card.querySelector('.txt')?.innerText?.trim() || "";
          const time = card.querySelector('.from')?.innerText?.trim() || "";
          const reposts = card.querySelector('[action-type="feed_list_forward"]')?.innerText?.trim() || "";
          return { text, time, reposts };
        });
      })()
    `);
    return { ok: true, query, count: data.length, items: data };
  } finally {
    await client.close();
  }
}

export async function runWeiboSearch(flags) {
  const result = await fetchWeiboSearch(flags);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}
```

> **Note:** If weibo `common.mjs` uses different helper names (e.g., `connectWeiboPage` vs `connectWeiboBrowser`), update the import. Check with: `grep "^export" src/sites/weibo/common.mjs`.

- [ ] **Step 9.4: Create `src/sites/zhihu/search.mjs`**

```js
// src/sites/zhihu/search.mjs
import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectZhihuPage, getZhihuPort } from "./common.mjs";

export async function fetchZhihuSearch(flags) {
  const query = String(flags.query || flags.symbol || "").trim();
  if (!query) throw new Error("Missing required --query or --symbol");
  const limit = Math.min(Number(flags.limit ?? 10), 20);
  const port = getZhihuPort(flags.port);
  const { client } = await connectZhihuPage(port);

  try {
    await navigate(client, `https://www.zhihu.com/search?type=content&q=${encodeURIComponent(query)}`, 6000);
    const data = await evaluate(client, `
      (() => {
        const items = [...document.querySelectorAll('.SearchResult-Card')].slice(0, ${limit});
        return items.map((card) => {
          const title = card.querySelector('h2')?.innerText?.trim() || "";
          const excerpt = card.querySelector('.RichText')?.innerText?.slice(0, 200)?.trim() || "";
          return { title, excerpt };
        });
      })()
    `);
    return { ok: true, query, count: data.length, items: data };
  } finally {
    await client.close();
  }
}

export async function runZhihuSearch(flags) {
  const result = await fetchZhihuSearch(flags);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}
```

> **Note:** Verify the helper names from zhihu's `common.mjs` before running.

- [ ] **Step 9.5: Create `src/sites/reddit/search.mjs`**

```js
// src/sites/reddit/search.mjs
import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectRedditPage, getRedditPort } from "./common.mjs";

export async function fetchRedditSearch(flags) {
  const query = String(flags.query || flags.symbol || "").trim();
  if (!query) throw new Error("Missing required --query or --symbol");
  const subreddit = String(flags.subreddit || "wallstreetbets+stocks+investing").trim();
  const limit = Math.min(Number(flags.limit ?? 10), 25);
  const port = getRedditPort(flags.port);
  const { client } = await connectRedditPage(port);

  try {
    const url = `https://www.reddit.com/r/${subreddit}/search/?q=${encodeURIComponent(query)}&sort=new&restrict_sr=1`;
    await navigate(client, url, 6000);
    const data = await evaluate(client, `
      (() => {
        const posts = [...document.querySelectorAll('article, [data-testid="post-container"]')].slice(0, ${limit});
        return posts.map((post) => {
          const title = post.querySelector('h3, [data-adclicklocation="title"]')?.innerText?.trim() || "";
          const votes = post.querySelector('[id^="vote-arrows"] span')?.innerText?.trim() || "";
          const comments = post.querySelector('[data-click-id="comments"]')?.innerText?.trim() || "";
          return { title, votes, comments };
        });
      })()
    `);
    return { ok: true, query, subreddit, count: data.length, items: data };
  } finally {
    await client.close();
  }
}

export async function runRedditSearch(flags) {
  const result = await fetchRedditSearch(flags);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}
```

> **Note:** Verify helper names from reddit's `common.mjs`. Reddit's DOM selectors change frequently — if this returns 0 items on a live test, inspect the page with DevTools and update the selector.

- [ ] **Step 9.6: Register all four in `src/command-registrations.mjs`**

In the xueqiu block:

```js
  registerSimple(reg, "xueqiu", "symbol-sentiment", "./sites/xueqiu/symbol-sentiment.mjs", "runXueqiuSymbolSentiment", { category: "finance" });
```

In the weibo block:

```js
  registerSimple(reg, "weibo", "search", "./sites/weibo/search.mjs", "runWeiboSearch", { category: "social" });
```

In the zhihu block:

```js
  registerSimple(reg, "zhihu", "search", "./sites/zhihu/search.mjs", "runZhihuSearch", { category: "social" });
```

In the reddit block:

```js
  registerSimple(reg, "reddit", "search", "./sites/reddit/search.mjs", "runRedditSearch", { category: "social" });
```

Add USAGE entries:

```js
  "xueqiu:symbol-sentiment": "node src/cli.mjs xueqiu symbol-sentiment --symbol NVDA [--port 9223]",
  "weibo:search":  "node src/cli.mjs weibo search --query <text> [--limit 10] [--port 9223]",
  "zhihu:search":  "node src/cli.mjs zhihu search --query <text> [--limit 10] [--port 9223]",
  "reddit:search": "node src/cli.mjs reddit search --query <text> [--subreddit wallstreetbets+stocks] [--limit 10] [--port 9223]",
```

- [ ] **Step 9.7: Verify registrations appear**

```bash
node src/cli.mjs sites list | grep -E "weibo|zhihu|reddit|xueqiu"
```

Expected: New commands appear.

- [ ] **Step 9.8: Commit**

```bash
git add src/sites/xueqiu/symbol-sentiment.mjs src/sites/weibo/search.mjs src/sites/zhihu/search.mjs src/sites/reddit/search.mjs src/command-registrations.mjs
git commit -m "feat: add sentiment source commands (xueqiu, weibo, zhihu, reddit)"
```

---

### Task 10: `src/sites/market/sentiment.mjs`

**Files:**
- Create: `src/sites/market/sentiment.mjs`
- Create: `test/market-sentiment.test.mjs`
- Modify: `src/sites/market/index.mjs`
- Modify: `src/command-registrations.mjs`

- [ ] **Step 10.1: Write failing tests**

```js
// test/market-sentiment.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { mergeSentimentResults } from "../src/sites/market/sentiment.mjs";

test("mergeSentimentResults aggregates mentions across sources", () => {
  const succeeded = [
    { name: "reddit", data: { ok: true, query: "NVDA", count: 12, items: [] } },
    { name: "zhihu", data: { ok: true, query: "NVDA", count: 5, items: [] } },
  ];
  const result = mergeSentimentResults(succeeded, "NVDA");
  assert.equal(result.mentions, 17);
  assert.equal(result.sources.length, 2);
});

test("mergeSentimentResults score is 0 when no sources succeed", () => {
  const result = mergeSentimentResults([], "NVDA");
  assert.equal(result.score, 0);
  assert.equal(result.mentions, 0);
  assert.deepEqual(result.sources, []);
});

test("mergeSentimentResults picks hot_rank from xueqiu when available", () => {
  const succeeded = [
    {
      name: "xueqiu",
      data: { ok: true, symbol: "BABA", followers: "5万", discussions: "1000", score: 0 },
    },
  ];
  const result = mergeSentimentResults(succeeded, "BABA");
  assert.ok(result.hot_rank !== undefined);
});
```

- [ ] **Step 10.2: Run test to verify it fails**

```bash
node --test test/market-sentiment.test.mjs
```

Expected: Error — module not found.

- [ ] **Step 10.3: Create `src/sites/market/sentiment.mjs`**

```js
// src/sites/market/sentiment.mjs
import { aggregate } from "../../core/market-aggregator.mjs";
import { fetchXueqiuSymbolSentiment } from "../xueqiu/symbol-sentiment.mjs";
import { fetchWeiboSearch } from "../weibo/search.mjs";
import { fetchZhihuSearch } from "../zhihu/search.mjs";
import { fetchRedditSearch } from "../reddit/search.mjs";

/**
 * Merge sentiment results from multiple sources into the unified sentiment schema.
 * @param {Array<{ name: string, data: unknown }>} succeeded
 * @param {string} symbol
 * @returns {{ score: number, hot_rank: unknown, mentions: number, sources: string[] }}
 */
export function mergeSentimentResults(succeeded, symbol) {
  let mentions = 0;
  let hotRank = null;
  const sources = [];

  for (const { name, data } of succeeded) {
    if (!data?.ok) continue;
    sources.push(name);

    if (name === "xueqiu") {
      hotRank = data.followers ?? null;
    } else if (name === "reddit" || name === "zhihu" || name === "weibo") {
      mentions += Number(data.count ?? 0);
    }
  }

  // Score: normalize mentions to -1..+1 range (0 = no data / neutral)
  // Without NLP, default to 0 (neutral) — agents can apply LLM for sentiment scoring
  const score = 0;

  return { score, hot_rank: hotRank, mentions, sources };
}

export async function fetchMarketSentiment(flags) {
  const symbol = String(flags.symbol || "").trim().toUpperCase();
  if (!symbol) throw new Error("Missing required --symbol");
  const timeoutMs = flags.quick ? 4000 : 0;
  const port = flags.port;

  const { data: sentiment, meta } = await aggregate({
    sources: [
      { name: "xueqiu", fetch: () => fetchXueqiuSymbolSentiment({ symbol, port }) },
      { name: "weibo", fetch: () => fetchWeiboSearch({ query: symbol, port, limit: 20 }) },
      { name: "zhihu", fetch: () => fetchZhihuSearch({ query: symbol, port, limit: 20 }) },
      { name: "reddit", fetch: () => fetchRedditSearch({ query: symbol, port, limit: 20 }) },
    ],
    timeoutMs,
    merge: (succeeded) => mergeSentimentResults(succeeded, symbol),
  });

  return {
    ok: true,
    symbol,
    sentiment,
    meta: { ...meta, command: "market sentiment" },
  };
}

export async function runMarketSentiment(flags) {
  const result = await fetchMarketSentiment(flags);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}
```

- [ ] **Step 10.4: Run tests to verify they pass**

```bash
node --test test/market-sentiment.test.mjs
```

Expected: 3 tests pass.

- [ ] **Step 10.5: Update `src/sites/market/index.mjs`**

```js
// src/sites/market/index.mjs
export { fetchMarketFlow, runMarketFlow } from "./flow.mjs";
export { fetchMarketQuote, runMarketQuote } from "./quote.mjs";
export { fetchMarketTechnicals, runMarketTechnicals } from "./technicals.mjs";
export { fetchMarketSentiment, runMarketSentiment } from "./sentiment.mjs";
```

- [ ] **Step 10.6: Register in `src/command-registrations.mjs`**

After `market:technicals`:

```js
  reg.register({
    site: "market", action: "sentiment", name: "market sentiment",
    category: "finance",
    description: "Aggregate sentiment from xueqiu, weibo, zhihu, reddit",
    usage: "node src/cli.mjs market sentiment --symbol NVDA [--quick] [--port 9223]",
    handler: async (flags) => {
      const { runMarketSentiment } = await import("./sites/market/sentiment.mjs");
      return runMarketSentiment(flags);
    },
  });
```

Add USAGE entry:

```js
  "market:sentiment": "node src/cli.mjs market sentiment --symbol NVDA [--quick] [--port 9223]",
```

- [ ] **Step 10.7: Commit**

```bash
git add src/sites/market/sentiment.mjs src/sites/market/index.mjs src/command-registrations.mjs test/market-sentiment.test.mjs
git commit -m "feat: add market sentiment command aggregating xueqiu, weibo, zhihu, reddit"
```

---

### Task 11: `src/sites/market/thesis.mjs` — rule engine

**Files:**
- Create: `src/sites/market/thesis.mjs`
- Create: `test/market-thesis.test.mjs`
- Modify: `src/sites/market/index.mjs`
- Modify: `src/command-registrations.mjs`

- [ ] **Step 11.1: Write failing tests**

```js
// test/market-thesis.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { computeBias, computeConfidence, buildFlags, buildThesis } from "../src/sites/market/thesis.mjs";

test("computeBias returns bullish when majority of votes are bullish", () => {
  assert.equal(computeBias({ flow: "bullish", putCallRatio: 0.6, technicals: "up" }), "bullish");
});

test("computeBias returns bearish when majority are bearish", () => {
  assert.equal(computeBias({ flow: "bearish", putCallRatio: 1.5, technicals: "down" }), "bearish");
});

test("computeBias returns neutral on tie", () => {
  assert.equal(computeBias({ flow: "bullish", putCallRatio: 1.0, technicals: "down" }), "neutral");
});

test("computeBias returns neutral when all inputs are null", () => {
  assert.equal(computeBias({ flow: null, putCallRatio: null, technicals: null }), "neutral");
});

test("computeConfidence reflects fraction of successful sources", () => {
  assert.equal(computeConfidence(["barchart", "unusual-whales"], ["whalestream"]), Number((2 / 3).toFixed(2)));
});

test("computeConfidence returns 0 when no sources", () => {
  assert.equal(computeConfidence([], []), 0);
});

test("buildFlags detects near-expiry spike", () => {
  const today = new Date();
  const nearExpiry = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const trades = [{ ticker: "NVDA", expiry: nearExpiry, premiumValue: 2000000, side: "call" }];
  const flags = buildFlags(trades);
  assert.ok(flags.some((f) => f.includes("near-expiry")));
});

test("buildThesis returns complete structure", () => {
  const result = buildThesis({
    symbol: "NVDA",
    flow: { net_sentiment: "bullish", put_call_ratio: 0.65, notable_trades: [], sources: ["barchart"] },
    quote: { price: 950, change_pct: 1.5, volume: 40000000, source: "barchart" },
    technicals: { trend: "up", rsi: null, signals: ["Buy"], source: "barchart" },
    sentiment: { score: 0, hot_rank: null, mentions: 15, sources: ["reddit"] },
    meta: { sources_ok: ["barchart", "reddit"], sources_skipped: [] },
  });
  assert.equal(result.thesis.bias, "bullish");
  assert.ok(typeof result.thesis.confidence === "number");
  assert.ok(typeof result.thesis.summary === "string");
  assert.ok(Array.isArray(result.thesis.flags));
});
```

- [ ] **Step 11.2: Run test to verify it fails**

```bash
node --test test/market-thesis.test.mjs
```

Expected: Error — module not found.

- [ ] **Step 11.3: Create `src/sites/market/thesis.mjs`**

```js
// src/sites/market/thesis.mjs
import { fetchMarketFlow } from "./flow.mjs";
import { fetchMarketQuote } from "./quote.mjs";
import { fetchMarketTechnicals } from "./technicals.mjs";
import { fetchMarketSentiment } from "./sentiment.mjs";

/**
 * Map put/call ratio to a sentiment vote.
 * @param {number|null} ratio
 * @returns {'bullish'|'bearish'|'neutral'}
 */
function pcRatioVote(ratio) {
  if (ratio == null) return "neutral";
  if (ratio < 0.7) return "bullish";
  if (ratio > 1.3) return "bearish";
  return "neutral";
}

/**
 * Majority vote across three signals. Ties → neutral.
 * @param {{ flow: string|null, putCallRatio: number|null, technicals: string|null }} signals
 * @returns {'bullish'|'bearish'|'neutral'}
 */
export function computeBias({ flow, putCallRatio, technicals }) {
  const votes = [
    flow === "bullish" ? "bullish" : flow === "bearish" ? "bearish" : "neutral",
    pcRatioVote(putCallRatio),
    technicals === "up" ? "bullish" : technicals === "down" ? "bearish" : "neutral",
  ];
  const counts = { bullish: 0, bearish: 0, neutral: 0 };
  for (const v of votes) counts[v] += 1;
  if (counts.bullish > counts.bearish && counts.bullish > counts.neutral) return "bullish";
  if (counts.bearish > counts.bullish && counts.bearish > counts.neutral) return "bearish";
  return "neutral";
}

/**
 * Confidence = sources_ok / (sources_ok + sources_skipped), rounded to 2dp.
 * @param {string[]} sourcesOk
 * @param {string[]} sourcesSkipped
 * @returns {number}
 */
export function computeConfidence(sourcesOk, sourcesSkipped) {
  const total = sourcesOk.length + sourcesSkipped.length;
  if (!total) return 0;
  return Number((sourcesOk.length / total).toFixed(2));
}

/**
 * Build anomaly flag strings from notable trades.
 * @param {Array<{ ticker, expiry, premiumValue, side }>} trades
 * @returns {string[]}
 */
export function buildFlags(trades) {
  const flags = [];
  const today = Date.now();
  for (const trade of trades) {
    if (trade.expiry) {
      const dte = Math.round((new Date(trade.expiry).getTime() - today) / 86400000);
      if (dte >= 0 && dte <= 5) flags.push(`near-expiry spike: ${trade.ticker} ${trade.side} exp ${trade.expiry}`);
    }
    if (trade.premiumValue != null && trade.premiumValue >= 5_000_000) {
      flags.push(`large-premium: ${trade.ticker} ${trade.side} $${(trade.premiumValue / 1_000_000).toFixed(1)}M`);
    }
  }
  return flags;
}

/**
 * Compose the thesis from all four dimension results.
 * @param {{ symbol, flow, quote, technicals, sentiment, meta }} dimensions
 * @returns {{ ok, symbol, quote, flow, technicals, sentiment, thesis, meta }}
 */
export function buildThesis({ symbol, flow, quote, technicals, sentiment, meta }) {
  const bias = computeBias({
    flow: flow?.net_sentiment ?? null,
    putCallRatio: flow?.put_call_ratio ?? null,
    technicals: technicals?.trend ?? null,
  });
  const confidence = computeConfidence(meta?.sources_ok ?? [], meta?.sources_skipped ?? []);
  const flags = buildFlags(flow?.notable_trades ?? []);

  const summary = [
    `${symbol}: bias=${bias}, confidence=${confidence}`,
    quote ? `price=${quote.price} (${quote.change_pct > 0 ? "+" : ""}${quote.change_pct}%)` : null,
    technicals ? `technicals=${technicals.trend}` : null,
    flow ? `flow=${flow.net_sentiment}, p/c=${flow.put_call_ratio ?? "n/a"}` : null,
    sentiment?.mentions ? `mentions=${sentiment.mentions}` : null,
    flags.length ? `flags: ${flags.join("; ")}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    ok: true,
    symbol,
    quote: quote ?? null,
    flow: flow ?? null,
    technicals: technicals ?? null,
    sentiment: sentiment ?? null,
    thesis: { bias, confidence, summary, flags },
    meta,
  };
}

export async function fetchMarketThesis(flags) {
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

  const get = (result) => {
    if (result.status === "fulfilled" && result.value?.ok) {
      allSourcesOk.push(...(result.value.meta?.sources_ok ?? []));
      allSourcesSkipped.push(...(result.value.meta?.sources_skipped ?? []));
      return result.value;
    }
    return null;
  };

  const flowData = get(flowResult);
  const quoteData = get(quoteResult);
  const techData = get(technicalsResult);
  const sentimentData = get(sentimentResult);

  return buildThesis({
    symbol,
    flow: flowData?.flow ?? null,
    quote: quoteData?.quote ?? null,
    technicals: techData?.technicals ?? null,
    sentiment: sentimentData?.sentiment ?? null,
    meta: {
      sources_ok: allSourcesOk,
      sources_skipped: allSourcesSkipped,
      command: "market thesis",
    },
  });
}

export async function runMarketThesis(flags) {
  const result = await fetchMarketThesis(flags);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}
```

- [ ] **Step 11.4: Run tests to verify they pass**

```bash
node --test test/market-thesis.test.mjs
```

Expected: 8 tests pass.

- [ ] **Step 11.5: Update `src/sites/market/index.mjs`**

```js
// src/sites/market/index.mjs
export { fetchMarketFlow, runMarketFlow } from "./flow.mjs";
export { fetchMarketQuote, runMarketQuote } from "./quote.mjs";
export { fetchMarketTechnicals, runMarketTechnicals } from "./technicals.mjs";
export { fetchMarketSentiment, runMarketSentiment } from "./sentiment.mjs";
export { fetchMarketThesis, runMarketThesis } from "./thesis.mjs";
```

- [ ] **Step 11.6: Register in `src/command-registrations.mjs`**

After `market:sentiment`:

```js
  reg.register({
    site: "market", action: "thesis", name: "market thesis",
    category: "finance",
    description: "Full market thesis: flow + quote + technicals + sentiment → bias/confidence/flags",
    usage: "node src/cli.mjs market thesis --symbol NVDA [--quick] [--port 9223]",
    handler: async (flags) => {
      const { runMarketThesis } = await import("./sites/market/thesis.mjs");
      return runMarketThesis(flags);
    },
  });
```

Add USAGE entry:

```js
  "market:thesis": "node src/cli.mjs market thesis --symbol NVDA [--quick] [--port 9223]",
```

- [ ] **Step 11.7: Run the full test suite**

```bash
npm test
```

Expected: All existing tests pass; new tests pass.

- [ ] **Step 11.8: Live smoke test**

```bash
node src/cli.mjs browser ensure --port 9223
node src/cli.mjs market flow --symbol NVDA --quick --port 9223
node src/cli.mjs market thesis --symbol NVDA --quick --port 9223
```

Expected: JSON output with `ok: true`, populated `flow`, `thesis.bias`, `thesis.confidence`.

- [ ] **Step 11.9: Commit**

```bash
git add src/sites/market/thesis.mjs src/sites/market/index.mjs src/command-registrations.mjs test/market-thesis.test.mjs
git commit -m "feat: add market thesis rule engine (bias vote, confidence, flags, summary)"
```

---

## Completion Checklist

- [ ] `npm test` passes with no regressions
- [ ] `node src/cli.mjs market thesis --symbol NVDA --quick --port 9223` returns `ok: true` with `thesis.bias` set
- [ ] `node src/cli.mjs market flow --symbol SPY --port 9223` returns aggregated flow from ≥1 source
- [ ] `meta.sources_skipped` populated correctly when a source is unavailable
- [ ] All new commands appear in `node src/cli.mjs sites list`
- [ ] `--json` flag wraps output in `{ ok, data, meta }` envelope on all new commands
