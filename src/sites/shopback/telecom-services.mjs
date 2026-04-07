import { fetchShopbackCategory } from "./category.mjs";
import { normalizeSortedItems, sortByCashback } from "./service-utils.mjs";

const TELECOM_TERMS = [
  "verizon",
  "at&t",
  "wireless",
  "internet",
  "esim",
  "4s esim",
];

export async function runShopbackTelecomServices(flags) {
  const limit = Math.min(Number(flags.limit ?? 10), 20);
  const mode = String(flags.sort || "auto").trim().toLowerCase();
  const category = await fetchShopbackCategory({
    ...flags,
    slug: "digital-services",
    limit: "30",
  });

  let items = normalizeSortedItems(sortByCashback(
    (category?.item?.merchants || []).filter((item) => {
      const text = `${item.name} ${item.cashback}`.toLowerCase();
      if (text.includes("private internet access")) return false;
      const hasCarrier = text.includes("verizon") || text.includes("at&t");
      const hasConnection = text.includes("wireless") || text.includes("internet") || text.includes("esim");
      return hasCarrier || hasConnection;
    }),
    mode,
  ), mode);
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
