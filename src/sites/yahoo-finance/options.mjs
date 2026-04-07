import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectYahooFinancePage, getQuoteUrl, getYahooFinancePort } from "./common.mjs";

export function round(value, digits = 4) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Number(Number(value).toFixed(digits));
}

export function parseYahooFinanceOptionsResponse({ symbol, type, expiration, limit, status, ok, text } = {}) {
  const maxItems = Number.isFinite(limit) ? Math.max(1, limit) : 20;

  if (!ok) {
    return {
      ok: false,
      symbol,
      type,
      expiration: expiration ?? null,
      status: status ?? null,
      message: "Yahoo Finance options request failed.",
      body: String(text || "").slice(0, 300),
    };
  }

  let json;
  try {
    json = JSON.parse(String(text || ""));
  } catch {
    return {
      ok: false,
      symbol,
      type,
      expiration: expiration ?? null,
      status: status ?? null,
      message: "Yahoo Finance options request failed.",
      body: String(text || "").slice(0, 300),
    };
  }

  const chain = json?.optionChain?.result?.[0];
  const options = chain?.options?.[0];
  const underlyingPrice = chain?.quote?.regularMarketPrice ?? null;
  const rows = type === "puts" ? [...(options?.puts || [])] : [...(options?.calls || [])];
  rows.sort((left, right) => {
    const leftDistance = Math.abs((left?.strike ?? 0) - (underlyingPrice ?? 0));
    const rightDistance = Math.abs((right?.strike ?? 0) - (underlyingPrice ?? 0));
    return leftDistance - rightDistance;
  });

  const items = rows.slice(0, maxItems).map((row) => ({
    contractSymbol: row?.contractSymbol || "",
    strike: round(row?.strike, 2),
    lastPrice: round(row?.lastPrice, 2),
    change: round(row?.change, 2),
    percentChange: round(row?.percentChange, 2),
    volume: row?.volume ?? null,
    openInterest: row?.openInterest ?? null,
    bid: round(row?.bid, 2),
    ask: round(row?.ask, 2),
    impliedVolatility: round(row?.impliedVolatility, 4),
    inTheMoney: Boolean(row?.inTheMoney),
    contractSize: row?.contractSize || "",
    expiration: row?.expiration ?? null,
    lastTradeDate: row?.lastTradeDate ?? null,
    currency: row?.currency || "",
  }));

  return {
    ok: true,
    symbol,
    type,
    requestedExpiration: expiration ?? null,
    underlyingPrice: round(underlyingPrice, 2),
    expirationDates: Array.isArray(chain?.expirationDates) ? chain.expirationDates : [],
    count: items.length,
    items,
  };
}

/**
 * Accept a Yahoo Finance expiration as either:
 *   - a UNIX timestamp (number or numeric string)
 *   - a YYYY-MM-DD date string (converted to midnight UTC timestamp)
 * Returns null if the input is null/undefined.
 * Throws if the input is non-null but unparseable.
 */
export function parseYahooExpiration(value) {
  if (value == null) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  // Numeric: treat as UNIX timestamp
  if (/^\d+$/.test(raw)) {
    const ts = Number(raw);
    if (!Number.isFinite(ts)) throw new Error("Invalid --expiration. Use a UNIX timestamp or YYYY-MM-DD");
    return ts;
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const ms = Date.UTC(
      Number(raw.slice(0, 4)),
      Number(raw.slice(5, 7)) - 1,
      Number(raw.slice(8, 10)),
    );
    if (!Number.isFinite(ms)) throw new Error(`Invalid date: ${raw}`);
    return Math.floor(ms / 1000);
  }

  throw new Error("Invalid --expiration. Use a UNIX timestamp or YYYY-MM-DD");
}

export async function runYahooFinanceOptions(flags) {
  const symbol = String(flags.symbol || "").trim().toUpperCase();
  const type = String(flags.type || "calls").trim().toLowerCase();
  const expiration = parseYahooExpiration(flags.expiration ?? null);
  const limit = Number(flags.limit ?? 20);

  if (!symbol) {
    throw new Error("Missing required --symbol");
  }
  if (!["calls", "puts"].includes(type)) {
    throw new Error("Invalid --type. Use calls or puts");
  }

  const port = getYahooFinancePort(flags.port);
  const { client } = await connectYahooFinancePage(symbol, port);

  try {
    await navigate(client, `${getQuoteUrl(symbol)}/options`, 3500);

    const result = await evaluate(client, `
      (async () => {
        const symbol = ${JSON.stringify(symbol)};
        const type = ${JSON.stringify(type)};
        const expiration = ${expiration == null ? "null" : expiration};
        const limit = ${Number.isFinite(limit) ? Math.max(1, limit) : 20};
        const crumb = window.YAHOO?.context?.user?.crumb || '';
        const url = new URL('https://query1.finance.yahoo.com/v7/finance/options/' + encodeURIComponent(symbol));
        if (expiration != null) url.searchParams.set('date', String(expiration));
        if (crumb) url.searchParams.set('crumb', crumb);

        const resp = await fetch(url.toString(), { credentials: 'include' });
        const text = await resp.text();
        return {
          ok: resp.ok,
          status: resp.status,
          text
        };
      })()
    `);

    const normalized = parseYahooFinanceOptionsResponse({
      symbol,
      type,
      expiration,
      limit,
      status: result?.status,
      ok: result?.ok,
      text: result?.text,
    });

    if (!normalized.ok) {
      process.stdout.write(`${JSON.stringify(normalized, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }

    process.stdout.write(`${JSON.stringify(normalized, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
