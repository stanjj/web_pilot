import { aggregate } from "../../core/market-aggregator.mjs";
import { fetchBarchartFlowSymbol } from "../barchart/flow-symbol.mjs";
import { fetchBarchartPutCallRatio } from "../barchart/put-call-ratio.mjs";
import { fetchBarchartVolSkew } from "../barchart/vol-skew.mjs";
import { fetchUnusualWhalesFlow, toFlowTrades as uwToFlowTrades } from "../unusual-whales/flow.mjs";
import { fetchWhaleStreamSummary, toFlowTrades as wsToFlowTrades } from "../whalestream/summary.mjs";

/**
 * Merge flow results from multiple sources into the unified flow schema.
 * @param {Array<{ name: string, data: unknown }>} succeeded
 * @returns {{ net_sentiment: string, put_call_ratio: number|null, notable_trades: unknown[], sources: string[] }}
 */
export function mergeFlowResults(succeeded) {
  const allTrades = [];
  let putCallRatio = null;
  let volSkew = [];

  for (const { name, data } of succeeded) {
    if (name === "barchart-ratio" && data?.ok) {
      putCallRatio = data.putCallRatio?.volume ?? data.putCallRatio?.openInterest ?? null;
      continue;
    }
    if (name === "barchart-vol-skew" && data?.ok) {
      volSkew = Array.isArray(data.items) ? data.items : [];
      continue;
    }
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
    put_call_ratio: putCallRatio,
    notable_trades: notableTrades,
    vol_skew: volSkew,
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
      { name: "barchart-ratio", fetch: () => fetchBarchartPutCallRatio({ symbol, port }) },
      { name: "barchart-vol-skew", fetch: () => fetchBarchartVolSkew({ symbol, port, limit: 20 }) },
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
