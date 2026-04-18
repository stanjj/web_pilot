import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectBarchartPage, getBarchartPort, getQuoteUrl } from "./common.mjs";

/**
 * Compact summary for a symbol: quote + key technical + options snapshot.
 * Designed for fast market checks — single command, minimal output.
 */
export async function runBarchartSummary(flags) {
  const symbol = String(flags.symbol || "").trim().toUpperCase();
  const port = getBarchartPort(flags.port);

  if (!symbol) {
    throw new Error("Missing required --symbol");
  }

  const { client } = await connectBarchartPage(symbol, port);

  try {
    await navigate(client, getQuoteUrl(symbol), 3500);

    const result = await evaluate(client, `
      (async () => {
        const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
        const headers = csrf ? { 'X-CSRF-TOKEN': csrf } : {};

        // Quote data from page
        const priceEl = document.querySelector('.pricechangeali498');
        const price = priceEl?.textContent?.trim() || '';
        const changeEl = document.querySelector('.pricechangealivalue');
        const change = changeEl?.textContent?.trim() || '';
        const pctEl = document.querySelector('.pricechangealipercent');
        const changePct = pctEl?.textContent?.trim() || '';

        // Technical overview from API
        let technicals = null;
        try {
          const techResp = await fetch(
            '/proxies/core-api/v1/quotes/get?list=quotes.quote.' + encodeURIComponent(${JSON.stringify(symbol)})
            + '&fields=fiftyTwoWkHigh,fiftyTwoWkLow,averageVolume20,volume&raw=1',
            { credentials: 'include', headers }
          );
          if (techResp.ok) {
            const techJson = JSON.parse(await techResp.text());
            const raw = techJson?.data?.[0]?.raw || techJson?.data?.[0] || {};
            technicals = {
              fiftyTwoWkHigh: raw.fiftyTwoWkHigh ?? null,
              fiftyTwoWkLow: raw.fiftyTwoWkLow ?? null,
              volume: raw.volume ?? null,
              avgVolume20: raw.averageVolume20 ?? null,
            };
          }
        } catch { /* non-critical */ }

        // Nearest-expiry options snapshot
        let optionsSnap = null;
        try {
          const optResp = await fetch(
            '/proxies/core-api/v1/options/chain?symbol=' + encodeURIComponent(${JSON.stringify(symbol)})
            + '&fields=strikePrice,volume,openInterest,expirationDate,optionType&raw=1',
            { credentials: 'include', headers }
          );
          if (optResp.ok) {
            const optJson = JSON.parse(await optResp.text());
            const data = Array.isArray(optJson?.data) ? optJson.data : [];
            const expiries = [...new Set(data.map(i => (i?.raw || i)?.expirationDate).filter(Boolean))].sort();
            const nearest = expiries[0];
            if (nearest) {
              const nearItems = data.filter(i => ((i?.raw || i)?.expirationDate) === nearest);
              const calls = nearItems.filter(i => ((i?.raw || i)?.optionType || '').toLowerCase() === 'call');
              const puts = nearItems.filter(i => ((i?.raw || i)?.optionType || '').toLowerCase() === 'put');
              const sumOI = (arr) => arr.reduce((s, i) => s + (Number((i?.raw || i)?.openInterest) || 0), 0);
              const sumVol = (arr) => arr.reduce((s, i) => s + (Number((i?.raw || i)?.volume) || 0), 0);
              optionsSnap = {
                nearestExpiry: nearest,
                callOI: sumOI(calls),
                putOI: sumOI(puts),
                callVolume: sumVol(calls),
                putVolume: sumVol(puts),
                pcRatio: sumVol(calls) > 0 ? (sumVol(puts) / sumVol(calls)).toFixed(2) : null,
              };
            }
          }
        } catch { /* non-critical */ }

        return {
          ok: true,
          symbol: ${JSON.stringify(symbol)},
          price,
          change,
          changePct,
          technicals,
          optionsSnap,
        };
      })()
    `);

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
