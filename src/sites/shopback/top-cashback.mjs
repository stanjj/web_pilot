import { fetchShopbackCategory } from "./category.mjs";
import { normalizeSortedItems } from "./service-utils.mjs";

function getSortMode(flags) {
  const mode = String(flags.sort || "auto").trim().toLowerCase();
  if (!["auto", "percent-only", "dollar-only"].includes(mode)) {
    throw new Error("Invalid --sort. Use auto, percent-only, or dollar-only");
  }
  return mode;
}

export async function runShopbackTopCashback(flags) {
  const slug = String(flags.slug || "").trim();
  const limit = Math.min(Number(flags.limit ?? 10), 30);
  const mode = getSortMode(flags);

  if (!slug) {
    throw new Error("Missing required --slug");
  }

  const category = await fetchShopbackCategory({
    ...flags,
    slug,
    limit: "40",
  });

  let items = normalizeSortedItems(category?.item?.merchants || [], mode);
  if (mode === "percent-only") {
    items = items.filter((item) => item.normalized.kind === "percent");
  } else if (mode === "dollar-only") {
    items = items.filter((item) => item.normalized.kind === "dollar");
  }

  process.stdout.write(`${JSON.stringify({
    ok: true,
    category: slug,
    sort: mode,
    count: Math.min(items.length, limit),
    items: items.slice(0, limit),
  }, null, 2)}\n`);
}
