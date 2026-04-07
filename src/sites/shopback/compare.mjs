import { fetchShopbackStore } from "./store.mjs";
import { parseCashbackValue } from "./service-utils.mjs";

function parseDurationDays(text) {
  const raw = String(text || "").trim().toLowerCase();
  const match = raw.match(/(\d+(?:\.\d+)?)\s*day/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

async function loadStore(port, slugOrUrl) {
  const result = await fetchShopbackStore({
    port,
    slug: /^https?:\/\//i.test(slugOrUrl) ? "" : slugOrUrl,
    url: /^https?:\/\//i.test(slugOrUrl) ? slugOrUrl : "",
    limit: "8",
  });
  const item = result?.item || {};
  return {
    name: item.name || slugOrUrl,
    url: item.url || "",
    cashback: item.cashback || "",
    normalized: parseCashbackValue(item.cashback),
    cap: item.cap || "",
    rewardLimit: item.rewardLimit || "",
    trackedIn: item.trackedIn || "",
    confirmedIn: item.confirmedIn || "",
    dealsCount: Array.isArray(item.deals) ? item.deals.length : 0,
    topDealTitle: item.deals?.[0]?.title || "",
    similarCount: Array.isArray(item.similarStores) ? item.similarStores.length : 0,
  };
}

export async function runShopbackCompare(flags) {
  const raw = String(flags.stores || "").trim();
  const port = String(flags.port ?? 9223);
  if (!raw) throw new Error("Missing required --stores");

  const stores = raw.split(",").map((value) => value.trim()).filter(Boolean);
  const items = [];
  for (const store of stores) {
    items.push(await loadStore(port, store));
  }

  const bestPercent = items
    .filter((item) => item.normalized.kind === "percent")
    .sort((a, b) => (b.normalized.value ?? -1) - (a.normalized.value ?? -1))[0] || null;
  const bestDollar = items
    .filter((item) => item.normalized.kind === "dollar")
    .sort((a, b) => (b.normalized.value ?? -1) - (a.normalized.value ?? -1))[0] || null;
  const fastestTracked = items
    .filter((item) => item.trackedIn)
    .sort((a, b) => parseDurationDays(a.trackedIn) - parseDurationDays(b.trackedIn))[0] || null;
  const fastestConfirmed = items
    .filter((item) => item.confirmedIn)
    .sort((a, b) => parseDurationDays(a.confirmedIn) - parseDurationDays(b.confirmedIn))[0] || null;

  process.stdout.write(`${JSON.stringify({
    ok: true,
    count: items.length,
    summary: {
      bestPercentCashback: bestPercent ? { name: bestPercent.name, cashback: bestPercent.cashback } : null,
      bestDollarCashback: bestDollar ? { name: bestDollar.name, cashback: bestDollar.cashback } : null,
      fastestTracked: fastestTracked ? { name: fastestTracked.name, trackedIn: fastestTracked.trackedIn } : null,
      fastestConfirmed: fastestConfirmed ? { name: fastestConfirmed.name, confirmedIn: fastestConfirmed.confirmedIn } : null,
    },
    items,
  }, null, 2)}\n`);
}
