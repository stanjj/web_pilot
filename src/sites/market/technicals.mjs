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
