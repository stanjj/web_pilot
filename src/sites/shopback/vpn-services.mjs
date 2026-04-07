import { fetchShopbackCategory } from "./category.mjs";
import { filterServices, normalizeSortedItems } from "./service-utils.mjs";

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

export async function runShopbackVpnServices(flags) {
  const limit = Math.min(Number(flags.limit ?? 10), 20);
  const mode = String(flags.sort || "auto").trim().toLowerCase();
  const category = await fetchShopbackCategory({
    ...flags,
    slug: "digital-services",
    limit: "30",
  });

  let items = normalizeSortedItems(filterServices(category?.item?.merchants || [], VPN_TERMS), mode);
  if (mode === "percent-only") {
    items = items.filter((item) => item.normalized.kind === "percent");
  } else if (mode === "dollar-only") {
    items = items.filter((item) => item.normalized.kind === "dollar");
  }
  items = items.slice(0, limit);

  process.stdout.write(`${JSON.stringify({
    ok: true,
    category: "digital-services",
    count: items.length,
    sort: mode,
    items,
  }, null, 2)}\n`);
}
