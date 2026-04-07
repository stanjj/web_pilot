import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectBarchartPage, getBarchartPort, getQuoteUrl } from "./common.mjs";

function round(value, digits = 2) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Number(Number(value).toFixed(digits));
}

export async function runBarchartGreeks(flags) {
  const symbol = String(flags.symbol || "").trim().toUpperCase();
  const expiration = flags.expiration ? String(flags.expiration).trim() : "";
  const limit = Number(flags.limit ?? 10);
  const port = getBarchartPort(flags.port);

  if (!symbol) {
    throw new Error("Missing required --symbol");
  }

  const { client } = await connectBarchartPage(symbol, port);

  try {
    await navigate(client, `${getQuoteUrl(symbol).replace("/overview", "/options")}`, 4000);

    const result = await evaluate(client, `
      (async () => {
        const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
        const headers = csrf ? { 'X-CSRF-TOKEN': csrf } : {};
        const fields = [
          'strikePrice','lastPrice','volume','openInterest',
          'volatility','delta','gamma','theta','vega','rho',
          'expirationDate','optionType','percentFromLast'
        ].join(',');

        let url = '/proxies/core-api/v1/options/chain?symbol=' + encodeURIComponent(${JSON.stringify(symbol)})
          + '&fields=' + fields + '&raw=1';
        if (${JSON.stringify(expiration)}) {
          url += '&expirationDate=' + encodeURIComponent(${JSON.stringify(expiration)});
        }

        const resp = await fetch(url, { credentials: 'include', headers });
        const text = await resp.text();
        if (!resp.ok) {
          return {
            ok: false,
            status: resp.status,
            needsLogin: resp.status === 401 || resp.status === 403,
            body: text.slice(0, 300)
          };
        }

        let json;
        try {
          json = JSON.parse(text);
        } catch (error) {
          return {
            ok: false,
            status: resp.status,
            needsLogin: false,
            body: text.slice(0, 300),
            error: String(error)
          };
        }

        let items = json?.data || [];
        if (!${JSON.stringify(expiration)}) {
          const expirations = items
            .map((item) => (item.raw || item).expirationDate || null)
            .filter(Boolean)
            .sort((a, b) => Date.parse(a) - Date.parse(b));
          const nearest = expirations[0];
          if (nearest) {
            items = items.filter((item) => ((item.raw || item).expirationDate || null) === nearest);
          }
        }

        const sortByDistance = (a, b) => {
          const aD = Math.abs((a.raw || a).percentFromLast || 999);
          const bD = Math.abs((b.raw || b).percentFromLast || 999);
          return aD - bD;
        };

        const calls = items
          .filter((item) => ((item.raw || item).optionType || '').toLowerCase() === 'call')
          .sort(sortByDistance)
          .slice(0, ${Number.isFinite(limit) ? Math.max(1, limit) : 10});

        const puts = items
          .filter((item) => ((item.raw || item).optionType || '').toLowerCase() === 'put')
          .sort(sortByDistance)
          .slice(0, ${Number.isFinite(limit) ? Math.max(1, limit) : 10});

        const mapRow = (item) => {
          const r = item.raw || item;
          return {
            type: r.optionType,
            strike: r.strikePrice,
            last: r.lastPrice,
            iv: r.volatility,
            delta: r.delta,
            gamma: r.gamma,
            theta: r.theta,
            vega: r.vega,
            rho: r.rho,
            volume: r.volume,
            openInterest: r.openInterest,
            expiration: r.expirationDate
          };
        };

        return {
          ok: true,
          expiration: calls[0] ? (calls[0].raw || calls[0]).expirationDate : (puts[0] ? (puts[0].raw || puts[0]).expirationDate : ''),
          items: [...calls.map(mapRow), ...puts.map(mapRow)]
        };
      })()
    `);

    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        symbol,
        needsLogin: Boolean(result?.needsLogin),
        status: result?.status ?? null,
        message: result?.needsLogin
          ? "Barchart greeks requires a logged-in session in the shared agent browser."
          : "Barchart greeks request failed.",
        body: result?.body || "",
      }, null, 2)}\n`);
      if (result?.needsLogin) process.exitCode = 2;
      else process.exitCode = 1;
      return;
    }

    const normalized = {
      ok: true,
      symbol,
      expiration: result.expiration || expiration,
      items: (result.items || []).map((row) => ({
        type: row.type || "",
        strike: round(row.strike),
        last: round(row.last),
        iv: round(row.iv),
        delta: round(row.delta, 4),
        gamma: round(row.gamma, 4),
        theta: round(row.theta, 4),
        vega: round(row.vega, 4),
        rho: round(row.rho, 4),
        volume: row.volume ?? null,
        openInterest: row.openInterest ?? null,
        expiration: row.expiration || "",
      })),
    };

    process.stdout.write(`${JSON.stringify(normalized, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
