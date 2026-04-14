# Market Thesis Engine - Design Revision

**Date:** 2026-04-13  
**Status:** Drafted for review  
**Supersedes:** Clarifies implementation expectations without deleting or replacing the original approved spec  
**Scope:** Complete the existing `market` implementation so that each sub-command and source behaves consistently with the original design

---

## Goal

Finish the `market` feature as a complete, agent-friendly command set rather than a partially implemented collection of subcommands. The focus is completion and alignment, not a rewrite.

This revision keeps the original product shape:
- `market quote`
- `market flow`
- `market technicals`
- `market sentiment`
- `market thesis`

The change is in execution discipline: tighten schemas, fill missing source integrations, and validate real CLI behavior before calling the feature done.

---

## Out of Scope

- Adding new finance sites beyond the existing approved set
- LLM-generated thesis text inside the toolkit
- Refactoring site modules unrelated to `market`
- Streaming updates or websocket infrastructure
- Productizing a scoring model beyond deterministic rule-based logic

---

## Execution Approach

Use the existing implementation as the starting point. Do not rebuild the feature from scratch.

Guiding rules:
- Prefer thin, site-scoped adapter changes over internal rewrites
- Keep `src/sites/market/*.mjs` as the orchestration layer
- Keep source-specific parsing in the source site module whenever possible
- Accept partial degradation, but never ambiguous output
- Validate structure first, completeness second, polish last

The target is not "commands exist." The target is "commands return stable, explicit, agent-consumable results."

---

## Data Contract

Every `market` sub-command must return a stable top-level envelope:

```json
{
  "ok": true,
  "symbol": "NVDA",
  "<dimension>": {},
  "meta": {
    "sources_ok": [],
    "sources_skipped": [],
    "elapsedMs": 0,
    "command": "market <dimension>"
  }
}
```

Rules:
- Top-level command success should not depend on every source succeeding
- If a dimension has no usable source data, the dimension value may be `null` or an empty collection, but the envelope must still be valid
- `sources_ok` and `sources_skipped` must list only sources that were actually attempted
- `elapsedMs` must be present on every sub-command and preserved in aggregate form where feasible
- `market thesis` must still return a thesis structure when one or more dimensions degrade

Dimension-specific expectations:
- `flow.put_call_ratio`: use `barchart` as the primary source; `null` is acceptable only when unavailable after a real attempt
- `technicals.trend`: derive from merged `barchart` and `tradingview` inputs; conflicting directional inputs should resolve conservatively to `sideways`
- `sentiment.score`: stay rule-based and neutral-safe for now; do not pretend to perform NLP
- `sentiment.mentions`: include discussion counts from all available sentiment sources, including `xueqiu` where extractable
- `sentiment.hot_rank`: should represent actual ranking or popularity signal, not a follower-count proxy unless explicitly documented as fallback

---

## Source Responsibilities

### Quote

- `barchart` is primary
- `yahoo-finance` is the fallback
- Merge behavior must be deterministic and stable across quick and non-quick mode

### Flow

- Aggregate `barchart`, `unusual-whales`, and `whalestream`
- Normalize all notable trades into one shared shape
- Populate `put_call_ratio` instead of leaving it permanently `null`
- Make `barchart vol-skew` available to thesis flag generation

### Technicals

- Merge `barchart` and `tradingview`
- Keep the output contract simple: `trend`, `rsi`, `signals`, `source` or merged-source semantics
- Avoid inventing a complex weighting model; conservative merge rules are preferable

### Sentiment

- Aggregate `xueqiu`, `weibo`, `zhihu`, and `reddit`
- Normalize count-like fields into `mentions`
- Keep `score` deterministic and explainable
- Do not fail the whole command because one public site drifts or rate-limits

### Thesis

- Remains fully rule-based
- Consumes the four dimensions exactly as returned by their sub-commands
- Must expose `bias`, `confidence`, `summary`, and `flags`

---

## Thesis Rules

### Bias

Compute bias from three signals:
- `flow.net_sentiment`
- `flow.put_call_ratio`
- `technicals.trend`

Decision rules:
- Put/call ratio below `0.7` votes bullish
- Put/call ratio above `1.3` votes bearish
- Otherwise put/call ratio votes neutral
- Technical `up` votes bullish
- Technical `down` votes bearish
- Anything else votes neutral
- Majority wins
- Ties resolve to neutral

### Confidence

Confidence remains a completeness score:

`sources_ok / (sources_ok + sources_skipped)`

It should reflect how much of the thesis was built from successful sources, not how strongly bullish or bearish the market is.

### Flags

Flags must come from explicit, testable rules only:
- Large premium single trade
- Near-expiry spike
- Extreme put/call ratio
- High vol-skew divergence

This revision explicitly rejects vague or narrative flags that cannot be reproduced in tests.

---

## Degradation Semantics

`--quick` and default mode must mean the same thing in every market dimension:

- `--quick`: per-source timeout of 4 seconds
- default mode: no timeout, wait for reachable sources

Behavioral rules:
- One failing source cannot abort a dimension if another source succeeds
- One degraded dimension cannot abort `market thesis`
- Degraded output must remain explicit through `sources_skipped`
- Silent `null` results without metadata are not acceptable

This is a reliability feature, not a best-effort convenience.

---

## Phased Completion Plan

### Phase A - Tighten the shared schema

Goal: make current outputs truly match the spec.

Work:
- Ensure every market sub-command returns the same top-level envelope style
- Fill `flow.put_call_ratio`
- Correct `sentiment.mentions` and `sentiment.hot_rank` semantics
- Expand thesis flags to include all promised rule-based anomalies
- Make `meta` consistent across sub-commands and thesis

### Phase B - Finish missing source integrations

Goal: remove the biggest completeness gaps.

Work:
- Add `tradingview` into `market technicals`
- Wire `barchart vol-skew` into thesis flag generation
- Verify `weibo`, `zhihu`, `reddit`, and `xueqiu` normalization in `market sentiment`
- Reconfirm `barchart primary + yahoo-finance fallback` behavior in quote mode

### Phase C - Align rule engine and degradation behavior

Goal: make thesis behavior deterministic under partial failure.

Work:
- Keep bias computation rule-based
- Ensure confidence uses the actual thesis source set
- Enforce the same quick-mode timeout semantics everywhere
- Return valid thesis output even under partial dimension failure

### Phase D - CLI validation and acceptance

Goal: prove the feature works as a command surface, not just as unit tests.

Work:
- Smoke test `market flow`
- Smoke test `market quote`
- Smoke test `market technicals`
- Smoke test `market sentiment`
- Smoke test `market thesis --quick`
- Smoke test `market thesis` without quick mode

Acceptance depends on stable structure, accurate degradation metadata, and usable agent-facing fields.

---

## Validation Strategy

Use two layers of verification:

### Unit-level verification

Test the following without relying on live sites:
- normalizers
- merge functions
- bias computation
- confidence computation
- thesis flag generation

### CLI-level verification

Run real commands to confirm:
- argument handling
- command registration
- shared browser path compatibility
- structured output shape
- degradation behavior when a source is unavailable

If a live source fails because of login state or page drift, that is acceptable only when the command still returns valid structured output with accurate metadata.

---

## Success Criteria

The feature is complete when all of the following are true:

- `market flow`, `quote`, `technicals`, `sentiment`, and `thesis` are independently callable
- `market thesis --symbol NVDA --quick --port 9223` returns a valid structured response in the expected quick-mode latency envelope
- Partial source failure degrades gracefully and is visible in metadata
- `thesis.bias`, `thesis.confidence`, `thesis.summary`, and `thesis.flags` are directly consumable by agents
- No dimension depends on hidden assumptions or undocumented fallback behavior

---

## Implementation Posture

This revision intentionally favors completion over ambition.

That means:
- no broad refactors
- no speculative analytics
- no extra sources
- no hidden magic

We finish the feature that was designed, tighten the contract, and validate it end to end.
