import { fetchShopbackCategory } from "./category.mjs";
import { normalizeSortedItems } from "./service-utils.mjs";
import { pickShopbackSection } from "./section-utils.mjs";

const TAX_TERMS = ["tax", "h&r", "block"];
const VPN_TERMS = [
  "vpn",
  "cyberghost",
  "expressvpn",
  "nordvpn",
  "surfshark",
  "private internet access",
  "purevpn",
  "personalvpn",
  "mcafee",
  "malwarebytes",
  "avg",
];

function filterTerms(items, terms) {
  return items.filter((item) => {
    const text = `${item.name} ${item.cashback}`.toLowerCase();
    return terms.some((term) => text.includes(term));
  });
}

function filterTelecom(items) {
  return items.filter((item) => {
    const text = `${item.name} ${item.cashback}`.toLowerCase();
    if (text.includes("private internet access")) return false;
    return text.includes("verizon")
      || text.includes("at&t")
      || text.includes("wireless")
      || text.includes("esim");
  });
}

export async function runShopbackRadar(flags) {
  const slug = String(flags.slug || "digital-services").trim();
  const limit = Math.min(Number(flags.limit ?? 5), 20);
  const minPercent = Number(flags["min-percent"] ?? 30);
  const minDollar = Number(flags["min-dollar"] ?? 30);

  const category = await fetchShopbackCategory({
    ...flags,
    slug,
    limit: "40",
  });

  const merchants = category?.item?.merchants || [];
  const boostedDeals = pickShopbackSection(category?.item, "Boosted Cashback Deals").items;
  const normalizedMerchants = normalizeSortedItems(merchants, "auto");
  const topCashback = normalizedMerchants.slice(0, limit);
  const boosted = normalizeSortedItems(boostedDeals, "auto").slice(0, limit);
  const alerts = normalizedMerchants
    .filter((item) => {
      if (item.normalized.kind === "percent") return (item.normalized.value ?? 0) >= minPercent;
      if (item.normalized.kind === "dollar") return (item.normalized.value ?? 0) >= minDollar;
      return false;
    })
    .slice(0, limit);
  const tax = normalizeSortedItems(filterTerms(merchants, TAX_TERMS), "auto").slice(0, limit);
  const vpn = normalizeSortedItems(filterTerms(merchants, VPN_TERMS), "auto").slice(0, limit);
  const telecom = normalizeSortedItems(filterTelecom(merchants), "auto").slice(0, limit);

  process.stdout.write(`${JSON.stringify({
    ok: true,
    category: slug,
    thresholds: { minPercent, minDollar },
    summary: {
      topCashback: topCashback[0] || null,
      topBoostedDeal: boosted[0] || null,
      topAlert: alerts[0] || null,
      topTax: tax[0] || null,
      topVpn: vpn[0] || null,
      topTelecom: telecom[0] || null,
    },
    sections: {
      topCashback,
      boostedDeals: boosted,
      alerts,
      tax,
      vpn,
      telecom,
    },
  }, null, 2)}\n`);
}
