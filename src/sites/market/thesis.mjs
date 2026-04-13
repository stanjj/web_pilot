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
