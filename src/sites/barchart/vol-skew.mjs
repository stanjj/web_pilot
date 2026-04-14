import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectBarchartPage, getBarchartPort, getQuoteUrl } from "./common.mjs";

function round(value, digits = 4) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Number(Number(value).toFixed(digits));
}

/**
 * Extract implied-volatility skew from the nearest-expiration options chain.
 * Returns call IV, put IV, and skew (put IV − call IV) by strike.
 */
export async function runBarchartVolSkew(flags) {
  const symbol = String(flags.symbol || "").trim().toUpperCase();
  const expiration = flags.expiration ? String(flags.expiration).trim() : null;
  const limit = Number(flags.limit ?? 20);
  const port = getBarchartPort(flags.port);

  if (!symbol) {
    throw new Error("Missing required --symbol");
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
          'strikePrice', 'volatility', 'expirationDate', 'optionType', 'percentFromLast'
        ].join(',');
        let url = '/proxies/core-api/v1/options/chain?symbol=' + encodeURIComponent(${JSON.stringify(symbol)})
          + '&fields=' + fields + '&raw=1';
        if (${JSON.stringify(expiration)}) {
          url += '&expirationDate=' + encodeURIComponent(${JSON.stringify(expiration)});
        }

        const resp = await fetch(url, { credentials: 'include', headers });
        const text = await resp.text();
        return { ok: resp.ok, status: resp.status, text };
      })()
    `);

    if (!result?.ok) {
      const needsLogin = result?.status === 401 || result?.status === 403;
      process.stdout.write(`${JSON.stringify({
        ok: false,
        symbol,
        needsLogin,
        status: result?.status ?? null,
        message: needsLogin
          ? "Barchart options chain requires a logged-in session in the shared agent browser."
          : "Barchart vol-skew request failed.",
      }, null, 2)}\n`);
      process.exitCode = needsLogin ? 2 : 1;
      return;
    }

    let json;
    try {
      json = JSON.parse(String(result?.text || ""));
    } catch {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        symbol,
        message: "Failed to parse options chain response.",
      }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }

    let items = Array.isArray(json?.data) ? json.data : [];

    // Pin to nearest expiry if none specified
    if (!expiration) {
      const expirations = [...new Set(
        items.map((item) => (item?.raw || item)?.expirationDate || null).filter(Boolean),
      )].sort((a, b) => Date.parse(a) - Date.parse(b));
      const nearest = expirations[0];
      if (nearest) {
        items = items.filter((item) => ((item?.raw || item)?.expirationDate || null) === nearest);
      }
    }

    // Build strike → { callIV, putIV, skew }
    const strikeMap = new Map();
    for (const item of items) {
      const raw = item?.raw || item;
      const strike = Number(raw?.strikePrice);
      const iv = Number(raw?.volatility);
      const type = String(raw?.optionType || "").toLowerCase();
      if (!Number.isFinite(strike) || !Number.isFinite(iv)) continue;

      if (!strikeMap.has(strike)) {
        strikeMap.set(strike, { strike, callIV: null, putIV: null });
      }
      const entry = strikeMap.get(strike);
      if (type === "call") entry.callIV = iv;
      if (type === "put") entry.putIV = iv;
    }

    const skewData = [...strikeMap.values()]
      .sort((a, b) => a.strike - b.strike)
      .map((entry) => ({
        strike: entry.strike,
        callIV: round(entry.callIV),
        putIV: round(entry.putIV),
        skew: entry.putIV != null && entry.callIV != null
          ? round(entry.putIV - entry.callIV)
          : null,
      }))
      .slice(0, limit);

    const usedExpiry = items[0] ? ((items[0]?.raw || items[0])?.expirationDate || null) : null;

    process.stdout.write(`${JSON.stringify({
      ok: true,
      symbol,
      expiration: usedExpiry,
      count: skewData.length,
      items: skewData,
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}

// ── Pure computation helper (no I/O) ─────────────────────────────────────────

export function buildVolSkewRows(items, limit = 20) {
  const rows = new Map();

  for (const item of items) {
    const raw = item?.raw || item;
    const strike = Number(raw?.strikePrice);
    const iv = Number(raw?.volatility);
    const optionType = String(raw?.optionType || "").toLowerCase();
    if (!Number.isFinite(strike) || !Number.isFinite(iv)) continue;

    if (!rows.has(strike)) {
      rows.set(strike, { strike, callIV: null, putIV: null });
    }

    const entry = rows.get(strike);
    if (optionType === "call") entry.callIV = round(iv);
    if (optionType === "put") entry.putIV = round(iv);
  }

  return [...rows.values()]
    .sort((a, b) => a.strike - b.strike)
    .map((entry) => ({
      strike: entry.strike,
      callIV: entry.callIV,
      putIV: entry.putIV,
      skew: entry.callIV != null && entry.putIV != null ? round(entry.putIV - entry.callIV) : null,
    }))
    .slice(0, limit);
}

// ── CDP-backed fetch helper usable by market orchestration ───────────────────

async function fetchOptionChainRows({ symbol, expiration, port }) {
  const { client } = await connectBarchartPage(symbol, port);
  try {
    await navigate(client, getQuoteUrl(symbol).replace("/overview", "/options"), 4000);
    const result = await evaluate(client, `
      (async () => {
        const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
        const headers = csrf ? { 'X-CSRF-TOKEN': csrf } : {};
        const fields = ['strikePrice', 'volatility', 'expirationDate', 'optionType'].join(',');
        let url = '/proxies/core-api/v1/options/chain?symbol=' + encodeURIComponent(${JSON.stringify(symbol)})
          + '&fields=' + fields + '&raw=1';
        if (${JSON.stringify(expiration)}) {
          url += '&expirationDate=' + encodeURIComponent(${JSON.stringify(expiration)});
        }
        const resp = await fetch(url, { credentials: 'include', headers });
        const text = await resp.text();
        return { ok: resp.ok, status: resp.status, text };
      })()
    `);
    if (!result?.ok) return [];
    try {
      const json = JSON.parse(String(result?.text || ""));
      return Array.isArray(json?.data) ? json.data : [];
    } catch {
      return [];
    }
  } finally {
    await client.close();
  }
}

export async function fetchBarchartVolSkew(flags) {
  const symbol = String(flags.symbol || "").trim().toUpperCase();
  const expiration = flags.expiration ? String(flags.expiration).trim() : null;
  const limit = Number(flags.limit ?? 20);
  const port = getBarchartPort(flags.port);
  if (!symbol) throw new Error("Missing required --symbol");
  if (expiration && !/^\d{4}-\d{2}-\d{2}$/.test(expiration)) {
    throw new Error("Invalid --expiration. Use YYYY-MM-DD format");
  }

  const chainRows = await fetchOptionChainRows({ symbol, expiration, port });
  const scopedRows = expiration ? chainRows : (() => {
    const expirations = [...new Set(
      chainRows.map((item) => (item?.raw || item)?.expirationDate || null).filter(Boolean),
    )].sort((a, b) => Date.parse(a) - Date.parse(b));
    const nearest = expirations[0];
    return nearest ? chainRows.filter((item) => ((item?.raw || item)?.expirationDate || null) === nearest) : chainRows;
  })();

  return {
    ok: true,
    symbol,
    expiration: expiration ?? ((scopedRows[0]?.raw || scopedRows[0])?.expirationDate ?? null),
    count: Math.min(scopedRows.length, limit),
    items: buildVolSkewRows(scopedRows, limit),
  };
}
