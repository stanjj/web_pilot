import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectYahooFinancePage, getQuoteUrl, getYahooFinancePort } from "./common.mjs";
import { parseYahooExpiration, parseYahooFinanceOptionsResponse } from "./options.mjs";

function round(value, digits = 4) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Number(Number(value).toFixed(digits));
}

/**
 * Fetch the nearest-expiry chain snapshot for a symbol: both calls and puts,
 * enriched with spread quality and a near-ATM flag.
 * Accepts --expiration as YYYY-MM-DD or UNIX timestamp.
 */
async function fetchChain(client, symbol, expiration, limit) {
  return evaluate(client, `
    (async () => {
      const symbol = ${JSON.stringify(symbol)};
      const expiration = ${expiration == null ? "null" : expiration};
      const crumb = window.YAHOO?.context?.user?.crumb || '';
      const url = new URL('https://query1.finance.yahoo.com/v7/finance/options/' + encodeURIComponent(symbol));
      if (expiration != null) url.searchParams.set('date', String(expiration));
      if (crumb) url.searchParams.set('crumb', crumb);

      const resp = await fetch(url.toString(), { credentials: 'include' });
      const text = await resp.text();
      return { ok: resp.ok, status: resp.status, text };
    })()
  `);
}

export async function runYahooFinanceChainSnapshot(flags) {
  const symbol = String(flags.symbol || "").trim().toUpperCase();
  const limit = Number(flags.limit ?? 20);
  const expiration = parseYahooExpiration(flags.expiration ?? null);
  const port = getYahooFinancePort(flags.port);

  if (!symbol) {
    throw new Error("Missing required --symbol");
  }

  const { client } = await connectYahooFinancePage(symbol, port);

  try {
    await navigate(client, `${getQuoteUrl(symbol)}/options`, 3500);
    const raw = await fetchChain(client, symbol, expiration, limit);

    const parsedCalls = parseYahooFinanceOptionsResponse({
      symbol,
      type: "calls",
      expiration,
      limit,
      status: raw?.status,
      ok: raw?.ok,
      text: raw?.text,
    });

    const parsedPuts = parseYahooFinanceOptionsResponse({
      symbol,
      type: "puts",
      expiration,
      limit,
      status: raw?.status,
      ok: raw?.ok,
      text: raw?.text,
    });

    if (!parsedCalls.ok) {
      process.stdout.write(`${JSON.stringify(parsedCalls, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }

    const underlyingPrice = parsedCalls.underlyingPrice;

    const enrich = (items) =>
      items.map((item) => {
        const spread = item.bid != null && item.ask != null ? round(item.ask - item.bid, 2) : null;
        const spreadQuality =
          spread == null ? null
          : spread <= 0.10 ? "tight"
          : spread <= 0.50 ? "normal"
          : "wide";
        const nearAtm =
          underlyingPrice != null && item.strike != null
            ? Math.abs(item.strike - underlyingPrice) / underlyingPrice <= 0.02
            : null;
        return { ...item, spread, spreadQuality, nearAtm };
      });

    process.stdout.write(`${JSON.stringify({
      ok: true,
      symbol,
      underlyingPrice,
      requestedExpiration: expiration ?? null,
      expirationDates: parsedCalls.expirationDates,
      calls: { count: parsedCalls.count, items: enrich(parsedCalls.items) },
      puts: { count: parsedPuts.count, items: enrich(parsedPuts.items) },
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}

/**
 * ATM options snapshot: returns the near-ATM calls and puts for the nearest expiry.
 * Useful for fast IV/premium reads without scanning the whole chain.
 */
export async function runYahooFinanceAtm(flags) {
  const symbol = String(flags.symbol || "").trim().toUpperCase();
  const expiration = parseYahooExpiration(flags.expiration ?? null);
  const atmWindow = Number(flags["atm-window"] ?? 5);
  const port = getYahooFinancePort(flags.port);

  if (!symbol) {
    throw new Error("Missing required --symbol");
  }

  const { client } = await connectYahooFinancePage(symbol, port);

  try {
    await navigate(client, `${getQuoteUrl(symbol)}/options`, 3500);
    const raw = await fetchChain(client, symbol, expiration, 50);

    const parsedCalls = parseYahooFinanceOptionsResponse({
      symbol,
      type: "calls",
      expiration,
      limit: 50,
      status: raw?.status,
      ok: raw?.ok,
      text: raw?.text,
    });

    if (!parsedCalls.ok) {
      process.stdout.write(`${JSON.stringify(parsedCalls, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }

    const parsedPuts = parseYahooFinanceOptionsResponse({
      symbol,
      type: "puts",
      expiration,
      limit: 50,
      status: raw?.status,
      ok: raw?.ok,
      text: raw?.text,
    });

    const underlyingPrice = parsedCalls.underlyingPrice ?? 0;
    const window = Math.max(1, atmWindow);

    const filterAtm = (items) =>
      items
        .filter((item) => {
          if (!underlyingPrice || item.strike == null) return false;
          return Math.abs(item.strike - underlyingPrice) / underlyingPrice <= 0.005 * window;
        })
        .map((item) => ({
          ...item,
          spread: item.bid != null && item.ask != null ? round(item.ask - item.bid, 2) : null,
        }));

    const atmCalls = filterAtm(parsedCalls.items);
    const atmPuts = filterAtm(parsedPuts.items);

    process.stdout.write(`${JSON.stringify({
      ok: true,
      symbol,
      underlyingPrice,
      requestedExpiration: expiration ?? null,
      expirationDates: parsedCalls.expirationDates,
      calls: atmCalls,
      puts: atmPuts,
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
