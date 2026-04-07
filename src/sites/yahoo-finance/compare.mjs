import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectYahooFinancePage, getQuoteUrl, getYahooFinancePort } from "./common.mjs";
import { extractNumber, parseYahooFinanceQuoteDocument } from "./quote.mjs";

const DEFAULT_SYMBOLS = ["SPY", "QQQ"];

/**
 * Compare multiple symbols side by side.
 * Uses the same quote extraction as yahoo-finance quote.
 * Symbols are fetched sequentially to reuse the same browser tab.
 */
export async function runYahooFinanceCompare(flags) {
  const rawSymbols = flags.symbols
    ? String(flags.symbols).split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
    : null;

  // Accept --symbol as an additional single symbol
  const singleSymbol = flags.symbol ? String(flags.symbol).trim().toUpperCase() : null;

  let symbols = rawSymbols ?? DEFAULT_SYMBOLS;
  if (singleSymbol && !symbols.includes(singleSymbol)) {
    symbols = [...symbols, singleSymbol];
  }

  if (symbols.length < 2) {
    throw new Error("At least two symbols are required. Use --symbols SPY,QQQ,AAPL");
  }

  const port = getYahooFinancePort(flags.port);

  // Connect using the first symbol's page (reuse tab across navigations)
  const { client } = await connectYahooFinancePage(symbols[0], port);

  try {
    const quotes = [];
    for (const symbol of symbols) {
      await navigate(client, getQuoteUrl(symbol), 3500);
      const raw = await evaluate(client, `
        (() => ({
          text: document.body.innerText || '',
          title: document.title,
          url: location.href,
        }))()
      `);
      const parsed = parseYahooFinanceQuoteDocument({
        symbol,
        text: raw?.text,
        title: raw?.title,
        url: raw?.url,
      });
      quotes.push(parsed);
    }

    // Build comparison table: keyed fields side by side
    const fields = [
      "price", "change", "changePct", "previousClose", "open",
      "volume", "averageVolume", "peRatio", "beta", "weekRange",
    ];

    const comparison = {};
    for (const field of fields) {
      const entry = {};
      for (const q of quotes) {
        entry[q.symbol] = q[field] ?? null;
      }
      comparison[field] = entry;
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      symbols,
      comparison,
      quotes,
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
