import { aggregate } from "../../core/market-aggregator.mjs";
import { fetchBarchartTechnicals, toTechnicalsSchema } from "../barchart/technicals.mjs";
import { fetchTradingViewTechnicals } from "../tradingview/technicals.mjs";

/**
 * Merge technicals from barchart and tradingview conservatively.
 * When both sources agree, use the shared trend. When they disagree, resolve to sideways.
 * @param {Array<{ name: string, data: unknown }>} succeeded
 * @returns {{ trend, rsi, signals, source } | null}
 */
export function mergeTechnicalsResults(succeeded) {
  const barchartEntry = succeeded.find((s) => s.name === "barchart");
  const tradingviewEntry = succeeded.find((s) => s.name === "tradingview");

  const barchartNormalized = barchartEntry ? toTechnicalsSchema(barchartEntry.data) : null;
  const tradingviewNormalized = tradingviewEntry?.data?.ok ? tradingviewEntry.data.technicals : null;

  if (barchartNormalized && tradingviewNormalized) {
    if (barchartNormalized.trend !== tradingviewNormalized.trend) {
      return {
        trend: "sideways",
        rsi: barchartNormalized.rsi ?? tradingviewNormalized.rsi ?? null,
        signals: [...(barchartNormalized.signals ?? []), ...(tradingviewNormalized.signals ?? [])],
        source: "barchart+tradingview",
      };
    }
    return {
      trend: barchartNormalized.trend,
      rsi: barchartNormalized.rsi ?? tradingviewNormalized.rsi ?? null,
      signals: [...(barchartNormalized.signals ?? []), ...(tradingviewNormalized.signals ?? [])],
      source: "barchart+tradingview",
    };
  }

  return barchartNormalized || tradingviewNormalized || null;
}

export async function fetchMarketTechnicals(flags) {
  const symbol = String(flags.symbol || "").trim().toUpperCase();
  if (!symbol) throw new Error("Missing required --symbol");
  const timeoutMs = flags.quick ? 4000 : 0;
  const port = flags.port;

  const { data: technicals, meta } = await aggregate({
    sources: [
      { name: "barchart", fetch: () => fetchBarchartTechnicals({ symbol, port }) },
      { name: "tradingview", fetch: () => fetchTradingViewTechnicals({ symbol, port }) },
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
