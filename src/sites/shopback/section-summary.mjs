import { fetchShopbackCategory } from "./category.mjs";
import { normalizeSortedItems } from "./service-utils.mjs";

export async function runShopbackSectionSummary(flags) {
  const slug = String(flags.slug || "digital-services").trim();
  const limit = Math.min(Number(flags.limit ?? 10), 30);

  const category = await fetchShopbackCategory({
    ...flags,
    slug,
    limit: "40",
  });

  const sectionEntries = category?.item?.sectionEntries || {};
  const items = Object.entries(sectionEntries)
    .map(([section, rows]) => {
      const normalized = normalizeSortedItems(rows, "auto");
      return {
        section,
        count: rows.length,
        topItem: normalized[0] || null,
      };
    })
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || String(a.section).localeCompare(String(b.section)))
    .slice(0, limit);

  process.stdout.write(`${JSON.stringify({
    ok: true,
    category: slug,
    count: items.length,
    items,
  }, null, 2)}\n`);
}
