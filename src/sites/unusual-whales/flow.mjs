import { getJsonResponseBody, navigate } from "../../core/cdp.mjs";
import {
  connectUnusualWhalesPage,
  getUnusualWhalesFlowUrl,
  getUnusualWhalesPort,
} from "./common.mjs";

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function inferSentiment(tags = []) {
  const raw = Array.isArray(tags) ? tags.join(" ").toLowerCase() : String(tags || "").toLowerCase();
  if (/\bbull/i.test(raw)) return "bullish";
  if (/\bbear/i.test(raw)) return "bearish";
  if (/\bneutral/i.test(raw)) return "neutral";
  return null;
}

function inferTradeType(tags = []) {
  const raw = Array.isArray(tags) ? tags.join(" ").toLowerCase() : String(tags || "").toLowerCase();
  if (/\bsweep\b/i.test(raw)) return "sweep";
  if (/\bblock\b/i.test(raw)) return "block";
  if (/\bsplit\b/i.test(raw)) return "split";
  return null;
}

function formatMoney(value) {
  if (!Number.isFinite(value)) return null;
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

export async function fetchUnusualWhalesFlow(flags) {
  const limit = Math.min(Number(flags.limit ?? 20), 50);
  const minPremium = Number(flags["min-premium"] ?? 500000);
  const port = getUnusualWhalesPort(flags.port);
  const { client } = await connectUnusualWhalesPage(port);

  try {
    await client.send("Network.enable");
    const responsePromise = client.waitForEvent(
      "Network.responseReceived",
      (params) => (
        String(params?.response?.url || "").includes("/api/option_trades/free?")
        && Number(params?.response?.status) === 200
      ),
      15000,
    );

    await navigate(client, getUnusualWhalesFlowUrl(), 5000);

    const responseEvent = await responsePromise;
    const payload = await getJsonResponseBody(client, responseEvent.requestId);
    const rows = Array.isArray(payload?.data) ? payload.data : [];

    const items = rows
      .map((item) => ({
        ticker: item?.underlying_symbol || null,
        type: inferTradeType(item?.tags),
        premiumPerContract: toNumber(item?.premium),
        premiumValue: (() => {
          const premiumPerContract = toNumber(item?.premium);
          const size = toNumber(item?.size);
          if (premiumPerContract == null || size == null) return null;
          return premiumPerContract * size * 100;
        })(),
        premium: null,
        side: String(item?.option_type || "").toLowerCase() || null,
        strike: toNumber(item?.strike),
        expiry: item?.expiry || null,
        sentiment: inferSentiment(item?.tags),
        size: toNumber(item?.size),
        tags: Array.isArray(item?.tags) ? item.tags : [],
        volumeRatio: toNumber(item?.multi_vol),
        openInterest: toNumber(item?.open_interest),
        price: toNumber(item?.price),
        spot: toNumber(item?.underlying_price),
        executedAt: item?.executed_at || null,
      }))
      .map((item) => ({
        ...item,
        premium: formatMoney(item.premiumValue),
      }))
      .filter((item) => item.ticker && item.side)
      .filter((item) => item.premiumValue != null && item.premiumValue >= minPremium)
      .sort((a, b) => (b.premiumValue || 0) - (a.premiumValue || 0))
      .slice(0, limit);

    return {
      ok: true,
      minPremium,
      sourceUrl: responseEvent?.response?.url || null,
      count: items.length,
      rawCount: rows.length,
      statusText: items.length ? null : "No trades with these filters.",
      items: items.map((item, index) => ({
        rank: index + 1,
        ticker: item.ticker,
        type: item.type,
        premium: item.premium,
        premiumValue: item.premiumValue,
        side: item.side,
        strike: item.strike,
        expiry: item.expiry,
        sentiment: item.sentiment,
        size: item.size,
        volumeRatio: item.volumeRatio,
        price: item.price,
        spot: item.spot,
        openInterest: item.openInterest,
        executedAt: item.executedAt,
        tags: item.tags,
      })),
    };
  } finally {
    await client.close();
  }
}

export async function runUnusualWhalesFlow(flags) {
  const result = await fetchUnusualWhalesFlow(flags);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}
