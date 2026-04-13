# Market Thesis Engine — Design Spec

**Date:** 2026-04-13  
**Status:** Approved  
**Scope:** Strengthen finance-related capabilities via a `market` aggregation command族

---

## Goal

Add a `market` command族 that aggregates data from multiple existing finance sites into a unified, structured analysis. Both manual CLI use and AI agent pipelines are first-class use cases.

---

## Out of Scope

- LLM integration inside the toolkit (thesis is rule-based; agents call LLM separately)
- New site integrations beyond those listed below
- Real-time streaming or WebSocket data
- Rewriting existing site implementations

---

## Architecture

### Approach

Aggregation-first: define a shared schema, make each site feed into it, build `market thesis` on top. No big refactor of existing sites — only add adapter output and new commands.

### Unified Output Schema

All `market` commands return this envelope:

```json
{
  "symbol": "NVDA",
  "timestamp": "2026-04-13T...",
  "quote": {
    "price": 0,
    "change_pct": 0,
    "volume": 0,
    "source": "barchart"
  },
  "flow": {
    "net_sentiment": "bullish | bearish | neutral",
    "put_call_ratio": 0,
    "notable_trades": [],
    "sources": []
  },
  "technicals": {
    "trend": "up | down | sideways",
    "rsi": 0,
    "signals": [],
    "source": "barchart"
  },
  "sentiment": {
    "score": 0,        // -1.0 (very bearish) to +1.0 (very bullish); 0 = neutral/unknown
    "hot_rank": null,
    "mentions": 0,
    "sources": []
  },
  "thesis": {
    "bias": "bullish | bearish | neutral",
    "confidence": 0.0,
    "summary": "",
    "flags": []
  },
  "meta": {
    "sources_ok": [],
    "sources_skipped": [],
    "elapsedMs": 0,
    "command": "market thesis"
  }
}
```

---

## Commands

### `market` command族

```sh
market quote      --symbol X          # Unified quote (barchart primary, yahoo-finance fallback)
market flow       --symbol X          # Aggregated options flow (barchart + unusual-whales + whalestream)
market technicals --symbol X          # Technical signals (barchart + tradingview)
market sentiment  --symbol X          # Sentiment (xueqiu + weibo + zhihu + reddit)
market thesis     --symbol X          # All of the above → structured analysis
```

### Modes

- **Pipeline mode** (default): each sub-command callable independently
- **Quick mode** (`--quick`): all sources fetched concurrently; sources exceeding 4s timeout are skipped

```sh
# Pipeline — inspect each dimension
node src/cli.mjs market flow       --symbol NVDA --port 9223
node src/cli.mjs market technicals --symbol NVDA --port 9223
node src/cli.mjs market thesis     --symbol NVDA --port 9223

# Quick — single-pass, ~5s target
node src/cli.mjs market thesis --symbol NVDA --quick --port 9223
```

---

## Components

### New Core Helper

**`src/core/market-aggregator.mjs`**

Concurrent multi-source fetcher with graceful degradation:

```js
await aggregate({
  sources: [barchartFlow, unusualWhalesFlow, whalestreamFlow],
  timeoutMs: 4000,   // --quick mode; no timeout in default mode
  merge: mergeFlowSchema,
})
// Returns: { data, meta: { sources_ok, sources_skipped, elapsedMs } }
```

Rules:
- At least one source succeeding per dimension is sufficient for a result
- Failed/skipped sources recorded in `meta.sources_skipped`, never block output
- Each source is independent — partial failure yields partial data, not an error

### New Site: `market`

```
src/sites/market/
├── index.mjs         # Register all market commands
├── quote.mjs         # barchart primary, yahoo-finance fallback
├── flow.mjs          # barchart + unusual-whales + whalestream via aggregator
├── technicals.mjs    # barchart + tradingview via aggregator
├── sentiment.mjs     # xueqiu + weibo + zhihu + reddit via aggregator
└── thesis.mjs        # Calls quote/flow/technicals/sentiment, applies rule engine
```

### Thesis Rule Engine (no LLM)

Bias determination (majority vote across 3 signals):
- `flow.net_sentiment` → derived from per-source sentiment labels; majority wins, tie → neutral
- `flow.put_call_ratio` → <0.7 bullish, >1.3 bearish, else neutral
- `technicals.trend` → directional vote from barchart/tradingview rating

Final `bias` = majority of the three votes; ties resolve to neutral.

Confidence = `sources_ok.length / total_sources_attempted`

Flags = anomaly detector:
- Large premium single trade
- Near-expiry spike (DTE < 5)
- High vol-skew divergence
- Extreme put/call ratio

Summary = template string (agent reads this and can optionally pass to LLM for prose)

---

## Site Adapter Changes

### Quote Dimension
| Site | Change |
|---|---|
| barchart | No change — primary source |
| yahoo-finance | Add fallback parser for schema drift resilience |
| xueqiu | Add `search` command (find symbol by name) |

### Flow Dimension
| Site | Change |
|---|---|
| barchart | Add `vol-skew` extraction |
| unusual-whales | Normalize output to flow schema |
| whalestream | Normalize output to flow schema |
| insiderfinance | Mark as optional; skipped when not logged in |

### Technicals Dimension
| Site | Change |
|---|---|
| barchart | Normalize technicals output (trend/rsi/signals) |
| tradingview | Add `technicals` command (read summary rating from page) |

### Sentiment Dimension (new)
| Site | Change |
|---|---|
| xueqiu | Add symbol hot-rank / discussion count query |
| weibo | Add keyword search command |
| zhihu | Add keyword search command |
| reddit | Add symbol search command (r/wallstreetbets, r/stocks, r/investing) |

---

## Degradation Strategy

- `--quick`: 4s timeout per source; skipped sources noted in meta
- Default mode: no timeout; waits for all reachable sources
- Each dimension degrades independently — thesis still runs with partial data
- `confidence` score reflects how complete the data is
- Agent consumers should check `meta.sources_skipped` to decide whether to retry

---

## Implementation Phases

### Phase 1 — Core + Flow (highest value, ship first)
1. `src/core/market-aggregator.mjs`
2. `src/sites/market/index.mjs` + `flow.mjs`
3. Normalize unusual-whales and whalestream output to flow schema
4. `market flow --symbol X` working end-to-end

### Phase 2 — Quote + Technicals
1. `src/sites/market/quote.mjs` (barchart primary + yahoo fallback)
2. `src/sites/barchart/` technicals normalization
3. `src/sites/tradingview/technicals.mjs` (new command)
4. `src/sites/market/technicals.mjs`
5. `market quote` and `market technicals` working

### Phase 3 — Site Command Additions
1. `src/sites/barchart/vol-skew.mjs`
2. `src/sites/xueqiu/search.mjs`
3. `src/sites/yahoo-finance/` fallback parser

### Phase 4 — Sentiment + Thesis
1. `src/sites/xueqiu/symbol-sentiment.mjs`
2. `src/sites/weibo/search.mjs`
3. `src/sites/zhihu/search.mjs`
4. `src/sites/reddit/search.mjs`
5. `src/sites/market/sentiment.mjs`
6. `src/sites/market/thesis.mjs` with rule engine
7. `market sentiment` and `market thesis --quick` working end-to-end

---

## Success Criteria

- `market thesis --symbol NVDA --quick --port 9223` returns a complete structured result in < 8s (quick mode)
- Each sub-command (`flow`, `quote`, `technicals`, `sentiment`) is independently callable
- Source failures degrade gracefully — no uncaught errors, clear `sources_skipped` metadata
- `--json` mode output matches the unified schema exactly
- Agent can consume `thesis.bias`, `thesis.confidence`, `thesis.flags` without further parsing
