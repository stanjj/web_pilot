import { evaluate, navigate } from "../../core/cdp.mjs";
import {
  connectPineifyPage,
  getPineifyHistoricalFlowUrl,
  getPineifyPort,
} from "./common.mjs";

const DEFAULT_SYMBOLS = ["SPY", "QQQ", "AAPL", "TSLA", "AMZN", "NVDA", "META", "MSFT", "AMD", "GOOGL"];

function formatMoney(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (Math.abs(num) >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(num) >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (Math.abs(num) >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
  return `$${num.toFixed(2)}`;
}

function parseSymbols(flags) {
  const raw = String(flags.symbols || flags.symbol || "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  return raw.length ? raw : DEFAULT_SYMBOLS;
}

function computeSentimentScore(contractType, volumeRatio, premiumValue) {
  const ratio = Number.isFinite(volumeRatio) ? Math.min(volumeRatio, 20) : 0;
  const premiumBoost = premiumValue >= 1_000_000 ? 2 : premiumValue >= 250_000 ? 1 : 0;
  const magnitude = ratio + premiumBoost;
  return contractType === "call" ? magnitude : contractType === "put" ? -magnitude : 0;
}

export async function fetchPineifyLiveFlow(flags) {
  const symbols = parseSymbols(flags);
  const limit = Math.min(Number(flags.limit ?? 20), 100);
  const minVolumeRatio = Number(flags["min-volume-ratio"] ?? 2);
  const port = getPineifyPort(flags.port);

  if (symbols.some((symbol) => !/^[A-Z.\-]{1,10}$/.test(symbol))) {
    throw new Error("Invalid --symbols");
  }

  const { client } = await connectPineifyPage(port);

  try {
    await navigate(client, getPineifyHistoricalFlowUrl(), 2500);

    const result = await evaluate(client, `
      (async () => {
        const symbols = ${JSON.stringify(symbols)};
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

        const datasets = [];
        for (const symbol of symbols) {
          const response = await fetch(\`https://pineifyapi.pineify.app/api/massive/options/snapshot/\${symbol}?limit=250&sort=strike_price&order=asc\`, {
            credentials: "include",
            headers,
          });
          const payload = await response.json();
          if (!response.ok || payload?.code !== 0) {
            datasets.push({
              symbol,
              ok: false,
              message: payload?.message || payload?.msg || \`Snapshot request failed: HTTP \${response.status}\`,
              results: [],
            });
            continue;
          }

          datasets.push({
            symbol,
            ok: true,
            results: payload?.data?.results || [],
          });
        }

        return { ok: true, datasets };
      })()
    `);

    if (!result?.ok) {
      return {
        ok: false,
        symbols,
        message: result?.message || "Pineify live flow failed.",
      };
    }

    const errors = [];
    const items = [];

    for (const dataset of result.datasets || []) {
      if (!dataset.ok) {
        errors.push({ symbol: dataset.symbol, message: dataset.message });
        continue;
      }

      for (const item of dataset.results || []) {
        const volume = Number(item?.day?.volume || 0);
        const openInterest = Number(item?.open_interest || 0);
        const volumeRatio = openInterest > 0 ? volume / openInterest : null;
        if (!Number.isFinite(volumeRatio) || volumeRatio < minVolumeRatio) continue;

        const contractType = String(item?.details?.contract_type || "").toLowerCase();
        const price = Number(item?.day?.close || item?.day?.vwap || 0);
        const premiumValue = volume * price * 100;
        const largeOrder = premiumValue >= 250_000;
        const sentimentScore = computeSentimentScore(contractType, volumeRatio, premiumValue);

        items.push({
          ticker: dataset.symbol,
          contract: item?.details?.ticker || "",
          side: contractType,
          strike: item?.details?.strike_price != null ? `$${Number(item.details.strike_price).toFixed(2)}` : "",
          expiry: item?.details?.expiration_date || "",
          volume: volume.toLocaleString("en-US"),
          openInterest: openInterest.toLocaleString("en-US"),
          volumeRatio: Number(volumeRatio.toFixed(2)),
          premium: formatMoney(premiumValue),
          premiumValue,
          largeOrder,
          sentimentScore: Number(sentimentScore.toFixed(2)),
          sentiment: sentimentScore > 0 ? "bullish" : sentimentScore < 0 ? "bearish" : "neutral",
        });
      }
    }

    const ranked = items
      .sort((a, b) => {
        if (b.volumeRatio !== a.volumeRatio) return b.volumeRatio - a.volumeRatio;
        return b.premiumValue - a.premiumValue;
      })
      .slice(0, limit)
      .map((item, index) => ({
        rank: index + 1,
        ...item,
      }));

    return {
      ok: true,
      symbols,
      minVolumeRatio,
      count: ranked.length,
      errors,
      items: ranked,
    };
  } finally {
    await client.close();
  }
}

export async function runPineifyLiveFlow(flags) {
  const result = await fetchPineifyLiveFlow(flags);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result?.ok) process.exitCode = 1;
  return result;
}
