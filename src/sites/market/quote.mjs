import { aggregate } from "../../core/market-aggregator.mjs";
import { fetchBarchartQuote } from "../barchart/quote.mjs";
import { fetchYahooFinanceQuote } from "../yahoo-finance/quote.mjs";

/**
 * Normalize raw site quote data to the unified quote schema.
 * Both barchart and yahoo-finance return: { ok, price, changePct, volume }
 */
function normalizeQuote(name, data) {
  if (!data?.ok) return null;
  return {
    price: data.price ?? null,
    change_pct: data.changePct ?? null,
    volume: data.volume ?? null,
    source: name,
  };
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
