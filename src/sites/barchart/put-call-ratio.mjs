import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectBarchartPage, getBarchartPort, getQuoteUrl } from "./common.mjs";

function round(value, digits = 2) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Number(Number(value).toFixed(digits));
}

/**
 * Compute put/call ratio, max pain, and gamma exposure from a full options chain.
 * Uses the nearest available expiration unless --expiration is specified.
 */
export async function runBarchartPutCallRatio(flags) {
  const symbol = String(flags.symbol || "").trim().toUpperCase();
  const expiration = flags.expiration ? String(flags.expiration).trim() : null;
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
          'strikePrice', 'volume', 'openInterest',
          'expirationDate', 'optionType', 'percentFromLast',
          'gamma', 'delta', 'lastPrice'
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
          : "Barchart put-call-ratio request failed.",
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

    // If no expiry requested, pin to nearest expiry
    if (!expiration) {
      const expirations = [...new Set(
        items
          .map((item) => (item?.raw || item)?.expirationDate || null)
          .filter(Boolean),
      )].sort((a, b) => Date.parse(a) - Date.parse(b));

      const nearest = expirations[0];
      if (nearest) {
        items = items.filter((item) => ((item?.raw || item)?.expirationDate || null) === nearest);
      }
    }

    const calls = items.filter((item) => ((item?.raw || item)?.optionType || "").toLowerCase() === "call");
    const puts = items.filter((item) => ((item?.raw || item)?.optionType || "").toLowerCase() === "put");

    const sumField = (arr, field) =>
      arr.reduce((acc, item) => {
        const val = Number((item?.raw || item)?.[field]);
        return acc + (Number.isFinite(val) ? val : 0);
      }, 0);

    const callVolume = sumField(calls, "volume");
    const putVolume = sumField(puts, "volume");
    const callOI = sumField(calls, "openInterest");
    const putOI = sumField(puts, "openInterest");

    const pcRatioVolume = callVolume > 0 ? round(putVolume / callVolume, 4) : null;
    const pcRatioOI = callOI > 0 ? round(putOI / callOI, 4) : null;

    // Max pain: strike where total value of expiring options is minimized
    const allStrikes = [...new Set(
      items.map((item) => Number((item?.raw || item)?.strikePrice)).filter((v) => Number.isFinite(v)),
    )].sort((a, b) => a - b);

    let maxPainStrike = null;
    let maxPainMinValue = Infinity;

    for (const testStrike of allStrikes) {
      let totalValue = 0;
      for (const item of items) {
        const row = item?.raw || item;
        const strike = Number(row?.strikePrice);
        const oi = Number(row?.openInterest) || 0;
        const type = (row?.optionType || "").toLowerCase();
        if (!Number.isFinite(strike)) continue;
        if (type === "call" && testStrike > strike) totalValue += (testStrike - strike) * oi * 100;
        if (type === "put" && testStrike < strike) totalValue += (strike - testStrike) * oi * 100;
      }
      if (totalValue < maxPainMinValue) {
        maxPainMinValue = totalValue;
        maxPainStrike = testStrike;
      }
    }

    // Gamma exposure (GEX): sum of gamma * OI * 100 for calls minus puts
    // GEX positive = dealers long gamma (stabilizing), negative = short gamma (destabilizing)
    let callGex = 0;
    let putGex = 0;
    for (const item of calls) {
      const row = item?.raw || item;
      const gamma = Number(row?.gamma);
      const oi = Number(row?.openInterest) || 0;
      if (Number.isFinite(gamma)) callGex += gamma * oi * 100;
    }
    for (const item of puts) {
      const row = item?.raw || item;
      const gamma = Number(row?.gamma);
      const oi = Number(row?.openInterest) || 0;
      if (Number.isFinite(gamma)) putGex += gamma * oi * 100;
    }
    const netGex = round(callGex - putGex, 2);

    // Effective expiry used
    const effectiveExpiry = expiration ||
      (items[0]?.raw || items[0])?.expirationDate ||
      null;

    process.stdout.write(`${JSON.stringify({
      ok: true,
      symbol,
      expiration: effectiveExpiry,
      putCallRatio: {
        volume: pcRatioVolume,
        openInterest: pcRatioOI,
        callVolume,
        putVolume,
        callOI,
        putOI,
      },
      maxPain: maxPainStrike,
      gammaExposure: {
        net: netGex,
        callGex: round(callGex, 2),
        putGex: round(putGex, 2),
      },
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
