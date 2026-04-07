import { fetchShopbackCategory } from "./category.mjs";
import { normalizeSortedItems } from "./service-utils.mjs";
import { pickShopbackSection } from "./section-utils.mjs";

export async function runShopbackSection(flags) {
  const slug = String(flags.slug || "").trim();
  const section = String(flags.section || "").trim().toLowerCase();
  const limit = Math.min(Number(flags.limit ?? 10), 30);
  const sort = String(flags.sort || "auto").trim().toLowerCase();

  if (!slug) throw new Error("Missing required --slug");
  if (!section) throw new Error("Missing required --section");

  const category = await fetchShopbackCategory({
    ...flags,
    slug,
    limit: "40",
  });

  const picked = pickShopbackSection(category?.item, section);
  let items = picked.matchedKey ? normalizeSortedItems(picked.items, sort) : [];
  if (sort === "percent-only") {
    items = items.filter((item) => item.normalized.kind === "percent");
  } else if (sort === "dollar-only") {
    items = items.filter((item) => item.normalized.kind === "dollar");
  }

  process.stdout.write(`${JSON.stringify({
    ok: true,
    category: slug,
    section: picked.matchedKey,
    count: Math.min(items.length, limit),
    items: items.slice(0, limit),
  }, null, 2)}\n`);
}
