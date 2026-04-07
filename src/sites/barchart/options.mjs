import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectBarchartPage, getBarchartPort, getQuoteUrl } from "./common.mjs";

export function round(value, digits = 2) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Number(Number(value).toFixed(digits));
}

/**
 * Classify a contract relative to the underlying price.
 * @param {number|null} strike
 * @param {number|null} underlyingPrice
 * @param {"Call"|"Put"} optionType
 * @returns {"atm"|"itm"|"otm"|null}
 */
export function classifyMoneyness(strike, underlyingPrice, optionType) {
  if (strike == null || underlyingPrice == null || !underlyingPrice) return null;
  const diff = (strike - underlyingPrice) / underlyingPrice;
  if (Math.abs(diff) <= 0.01) return "atm";
  const type = String(optionType || "").toLowerCase();
  if (type === "call") return diff < 0 ? "itm" : "otm";
  if (type === "put") return diff > 0 ? "itm" : "otm";
  return null;
}

export function parseBarchartOptionsResponse({
  symbol,
  type,
  limit,
  expiration,
  strikeMin,
  strikeMax,
  moneyness,
  status,
  ok,
  text,
} = {}) {
  const maxItems = Number.isFinite(limit) ? Math.max(1, limit) : 20;

  if (!ok) {
    const needsLogin = status === 401 || status === 403;
    return {
      ok: false,
      symbol,
      type,
      needsLogin,
      status: status ?? null,
      message: needsLogin
        ? "Barchart options chain requires a logged-in session in the shared agent browser."
        : "Barchart options request failed.",
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
      needsLogin: false,
      status: status ?? null,
      message: "Barchart options request failed.",
      body: String(text || "").slice(0, 300),
    };
  }

  let items = Array.isArray(json?.data) ? json.data : [];

  // Filter by type (Call/Put)
  items = items.filter((item) => {
    const optionType = (item?.raw || item)?.optionType || "";
    return optionType.toLowerCase() === String(type || "").toLowerCase();
  });

  // Filter by expiration date (YYYY-MM-DD)
  if (expiration) {
    items = items.filter((item) => {
      const exp = (item?.raw || item)?.expirationDate || "";
      return exp === expiration;
    });
  }

  // Filter by strike range
  if (Number.isFinite(strikeMin)) {
    items = items.filter((item) => {
      const strike = Number((item?.raw || item)?.strikePrice);
      return Number.isFinite(strike) && strike >= strikeMin;
    });
  }
  if (Number.isFinite(strikeMax)) {
    items = items.filter((item) => {
      const strike = Number((item?.raw || item)?.strikePrice);
      return Number.isFinite(strike) && strike <= strikeMax;
    });
  }

  items.sort((left, right) => {
    const leftDistance = Math.abs((left?.raw || left)?.percentFromLast || 999);
    const rightDistance = Math.abs((right?.raw || right)?.percentFromLast || 999);
    return leftDistance - rightDistance;
  });

  // Get underlying price from first item for moneyness calculation
  const underlyingPriceFromPercentFromLast = (() => {
    const firstItem = items[0]?.raw || items[0];
    if (!firstItem) return null;
    const strike = Number(firstItem.strikePrice);
    const pct = Number(firstItem.percentFromLast);
    if (!Number.isFinite(strike) || !Number.isFinite(pct) || pct === 0) return null;
    return strike / (1 + pct / 100);
  })();

  const mappedItems = items.map((item) => {
    const row = item?.raw || item;
    const strike = Number(row?.strikePrice) || null;
    const m = classifyMoneyness(strike, underlyingPriceFromPercentFromLast, row?.optionType);
    return {
      strike: round(row?.strikePrice),
      bid: round(row?.bidPrice),
      ask: round(row?.askPrice),
      last: round(row?.lastPrice),
      change: round(row?.priceChange),
      volume: row?.volume ?? null,
      openInterest: row?.openInterest ?? null,
      iv: round(row?.volatility),
      delta: round(row?.delta, 4),
      gamma: round(row?.gamma, 4),
      theta: round(row?.theta, 4),
      vega: round(row?.vega, 4),
      expiration: row?.expirationDate || "",
      optionType: row?.optionType || "",
      moneyness: m,
    };
  });

  // Filter by moneyness after mapping
  const filteredItems = moneyness
    ? mappedItems.filter((item) => item.moneyness === moneyness)
    : mappedItems;

  return {
    ok: true,
    symbol,
    type,
    requestedExpiration: expiration ?? null,
    count: filteredItems.length,
    items: filteredItems.slice(0, maxItems),
  };
}

export async function runBarchartOptions(flags) {
  const symbol = String(flags.symbol || "").trim().toUpperCase();
  const type = String(flags.type || "Call");
  const limit = Number(flags.limit ?? 20);
  const expiration = flags.expiration ? String(flags.expiration).trim() : null;
  const strikeMin = flags["strike-min"] != null ? Number(flags["strike-min"]) : null;
  const strikeMax = flags["strike-max"] != null ? Number(flags["strike-max"]) : null;
  const moneyness = flags.moneyness ? String(flags.moneyness).trim().toLowerCase() : null;
  const port = getBarchartPort(flags.port);

  if (!symbol) {
    throw new Error("Missing required --symbol");
  }
  if (!["Call", "Put"].includes(type)) {
    throw new Error("Invalid --type. Use Call or Put");
  }
  if (moneyness && !["atm", "itm", "otm"].includes(moneyness)) {
    throw new Error("Invalid --moneyness. Use atm, itm, or otm");
  }
  if (expiration && !/^\d{4}-\d{2}-\d{2}$/.test(expiration)) {
    throw new Error("Invalid --expiration. Use YYYY-MM-DD format");
  }

  const { client } = await connectBarchartPage(symbol, port);

  try {
    await navigate(client, `${getQuoteUrl(symbol).replace("/overview", "/options")}`, 4000);

    const result = await evaluate(client, `
      (async () => {
        const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
        const headers = csrf ? { 'X-CSRF-TOKEN': csrf } : {};
        const fields = [
          'strikePrice','bidPrice','askPrice','lastPrice','priceChange',
          'volume','openInterest','volatility',
          'delta','gamma','theta','vega',
          'expirationDate','optionType','percentFromLast'
        ].join(',');
        let url = '/proxies/core-api/v1/options/chain?symbol=' + encodeURIComponent(${JSON.stringify(symbol)})
          + '&fields=' + fields + '&raw=1';
        if (${JSON.stringify(expiration)}) {
          url += '&expirationDate=' + encodeURIComponent(${JSON.stringify(expiration)});
        }

        const resp = await fetch(url, { credentials: 'include', headers });
        const text = await resp.text();
        return {
          ok: resp.ok,
          status: resp.status,
          text
        };
      })()
    `);

    const normalized = parseBarchartOptionsResponse({
      symbol,
      type,
      limit,
      expiration,
      strikeMin: Number.isFinite(strikeMin) ? strikeMin : null,
      strikeMax: Number.isFinite(strikeMax) ? strikeMax : null,
      moneyness,
      status: result?.status,
      ok: result?.ok,
      text: result?.text,
    });

    if (!normalized.ok) {
      process.stdout.write(`${JSON.stringify(normalized, null, 2)}\n`);
      if (normalized.needsLogin) process.exitCode = 2;
      else process.exitCode = 1;
      return;
    }

    process.stdout.write(`${JSON.stringify(normalized, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
