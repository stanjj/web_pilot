import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectBarchartPage, getBarchartPort, getQuoteUrl } from "./common.mjs";

export function round(value, digits = 2) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Number(Number(value).toFixed(digits));
}

export function parseBarchartOptionsResponse({ symbol, type, limit, status, ok, text } = {}) {
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
  items = items.filter((item) => {
    const optionType = (item?.raw || item)?.optionType || "";
    return optionType.toLowerCase() === String(type || "").toLowerCase();
  });

  items.sort((left, right) => {
    const leftDistance = Math.abs((left?.raw || left)?.percentFromLast || 999);
    const rightDistance = Math.abs((right?.raw || right)?.percentFromLast || 999);
    return leftDistance - rightDistance;
  });

  return {
    ok: true,
    symbol,
    type,
    count: items.length,
    items: items.slice(0, maxItems).map((item) => {
      const row = item?.raw || item;
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
      };
    }),
  };
}

export async function runBarchartOptions(flags) {
  const symbol = String(flags.symbol || "").trim().toUpperCase();
  const type = String(flags.type || "Call");
  const limit = Number(flags.limit ?? 20);
  const port = getBarchartPort(flags.port);

  if (!symbol) {
    throw new Error("Missing required --symbol");
  }
  if (!["Call", "Put"].includes(type)) {
    throw new Error("Invalid --type. Use Call or Put");
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
        const url = '/proxies/core-api/v1/options/chain?symbol=' + encodeURIComponent(${JSON.stringify(symbol)})
          + '&fields=' + fields + '&raw=1';

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
