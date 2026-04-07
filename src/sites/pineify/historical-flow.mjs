import { evaluate, navigate } from "../../core/cdp.mjs";
import {
  connectPineifyPage,
  getPineifyHistoricalFlowUrl,
  getPineifyPort,
} from "./common.mjs";

function formatMoney(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (Math.abs(num) >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(num) >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (Math.abs(num) >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
  return `$${num.toFixed(2)}`;
}

function formatPercent(value) {
  const num = Number(value);
  return Number.isFinite(num) ? `${(num * 100).toFixed(1)}%` : "—";
}

function computeDirection(contractType, volumeRatio) {
  if (!Number.isFinite(volumeRatio)) return "Neutral";
  if (contractType === "call" && volumeRatio >= 2) return "Bullish";
  if (contractType === "put" && volumeRatio >= 2) return "Bearish";
  return "Neutral";
}

export async function runPineifyHistoricalFlow(flags) {
  const symbol = String(flags.symbol || "AAPL").trim().toUpperCase();
  const limit = Math.min(Number(flags.limit ?? 20), 100);
  const port = getPineifyPort(flags.port);

  if (!/^[A-Z.\-]{1,10}$/.test(symbol)) {
    throw new Error("Invalid --symbol");
  }

  const { client } = await connectPineifyPage(port);

  try {
    await navigate(client, getPineifyHistoricalFlowUrl(), 2500);

    const result = await evaluate(client, `
      (async () => {
        const symbol = ${JSON.stringify(symbol)};
        const authRes = await fetch("https://pineifyapi.pineify.app/api/auth/site-token", {
          credentials: "include",
          headers: {
            "content-type": "application/json",
          },
        });
        const authJson = await authRes.json();
        const token = authJson?.data?.token;
        if (!token) {
          return { ok: false, message: authJson?.msg || "Failed to acquire Pineify site token" };
        }

        const headers = {
          "content-type": "application/json",
          "x-site-token": token,
        };

        const [snapshotRes, quoteRes] = await Promise.all([
          fetch(\`https://pineifyapi.pineify.app/api/massive/options/snapshot/\${symbol}?limit=250&sort=strike_price&order=asc\`, {
            credentials: "include",
            headers,
          }),
          fetch(\`https://pineifyapi.pineify.app/api/fmp/quote-short?symbol=\${symbol}\`, {
            credentials: "include",
            headers,
          }),
        ]);

        const snapshotJson = await snapshotRes.json();
        const quoteJson = await quoteRes.json();

        if (!snapshotRes.ok || snapshotJson?.code !== 0) {
          return {
            ok: false,
            message: snapshotJson?.message || snapshotJson?.msg || \`Snapshot request failed: HTTP \${snapshotRes.status}\`,
          };
        }

        return {
          ok: true,
          symbol,
          quote: quoteJson?.data?.[0] || null,
          results: snapshotJson?.data?.results || [],
        };
      })()
    `);

    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        symbol,
        message: result?.message || "Pineify historical flow failed.",
      }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }

    const normalized = (result.results || [])
      .map((item) => {
        const volume = Number(item?.day?.volume || 0);
        const openInterest = Number(item?.open_interest || 0);
        const price = Number(item?.day?.close || item?.day?.vwap || 0);
        const premiumValue = volume * price * 100;
        const volumeRatio = openInterest > 0 ? volume / openInterest : null;
        const contractType = String(item?.details?.contract_type || "").toLowerCase();
        const flags = [];
        if (Number.isFinite(volumeRatio) && volumeRatio >= 2) flags.push("UOA");
        if (premiumValue >= 25000) flags.push("LRG");
        return {
          contract: item?.details?.ticker || "",
          type: contractType,
          strike: item?.details?.strike_price != null ? `$${Number(item.details.strike_price).toFixed(2)}` : "",
          expiry: item?.details?.expiration_date || "",
          volume,
          openInterest,
          price,
          premiumValue,
          ivValue: Number(item?.greeks?.implied_volatility ?? item?.day?.implied_volatility),
          volumeRatio,
          direction: computeDirection(contractType, volumeRatio),
          flags,
        };
      })
      .filter((item) => item.contract)
      .sort((a, b) => b.premiumValue - a.premiumValue);

    const items = normalized.slice(0, limit).map((item, index) => ({
      rank: index + 1,
      contract: item.contract,
      type: item.type,
      strike: item.strike,
      expiry: item.expiry,
      volume: item.volume.toLocaleString("en-US"),
      openInterest: item.openInterest.toLocaleString("en-US"),
      price: item.price ? `$${item.price.toFixed(2)}` : "$0.00",
      premium: formatMoney(item.premiumValue),
      premiumValue: item.premiumValue,
      iv: formatPercent(item.ivValue),
      direction: item.direction,
      flags: item.flags,
      volumeValue: item.volume,
      openInterestValue: item.openInterest,
      volumeRatio: item.volumeRatio != null ? Number(item.volumeRatio.toFixed(2)) : null,
      largeOrder: item.flags.includes("LRG"),
      unusual: item.flags.includes("UOA"),
    }));

    const callVolume = normalized.filter((item) => item.type === "call").reduce((sum, item) => sum + item.volume, 0);
    const putVolume = normalized.filter((item) => item.type === "put").reduce((sum, item) => sum + item.volume, 0);
    const callPremiumValue = normalized.filter((item) => item.type === "call").reduce((sum, item) => sum + item.premiumValue, 0);
    const putPremiumValue = normalized.filter((item) => item.type === "put").reduce((sum, item) => sum + item.premiumValue, 0);
    const unusualCount = normalized.filter((item) => item.flags.includes("UOA")).length;
    const largeCount = normalized.filter((item) => item.flags.includes("LRG")).length;
    const putCallRatio = callVolume > 0 ? putVolume / callVolume : null;
    const sentiment = putCallRatio == null ? null : putCallRatio > 1 ? "Bearish Bias" : putCallRatio < 0.8 ? "Bullish Bias" : "Neutral";

    process.stdout.write(`${JSON.stringify({
      ok: true,
      symbol,
      spot: result.quote?.price != null ? `$${Number(result.quote.price).toFixed(2)}` : null,
      callVolume: callVolume.toLocaleString("en-US"),
      callPremium: formatMoney(callPremiumValue),
      putVolume: putVolume.toLocaleString("en-US"),
      putPremium: formatMoney(putPremiumValue),
      putCallRatio: putCallRatio != null ? Number(putCallRatio.toFixed(2)) : null,
      sentiment,
      unusualActivity: unusualCount,
      largeOrders: largeCount,
      count: items.length,
      empty: items.length === 0,
      items,
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
