function round(value, digits = 4) {
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

export function parseYahooExpiration(value) {
  if (value == null) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    const ts = Number(raw);
    if (!Number.isFinite(ts)) throw new Error("Invalid --expiration. Use a UNIX timestamp or YYYY-MM-DD");
    return ts;
  }

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