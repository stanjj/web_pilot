import { fetchShopbackCategory } from "./category.mjs";
import { normalizeSortedItems } from "./service-utils.mjs";
import { pickShopbackSection } from "./section-utils.mjs";

export async function runShopbackAlerts(flags) {
  const slug = String(flags.slug || "digital-services").trim();
  const section = String(flags.section || "").trim();
  const sections = String(flags.sections || "").trim();
  const limit = Math.min(Number(flags.limit ?? 10), 30);
  const minPercent = Number(flags["min-percent"] ?? 30);
  const minDollar = Number(flags["min-dollar"] ?? 30);

  const category = await fetchShopbackCategory({
    ...flags,
    slug,
    limit: "40",
  });

  const requestedSections = sections
    ? sections.split(",").map((value) => value.trim()).filter(Boolean)
    : [];

  let sourceItems = [];
  let matchedSections = [];
  if (requestedSections.length > 0) {
    for (const name of requestedSections) {
      const picked = pickShopbackSection(category?.item, name);
      if (!picked.matchedKey) continue;
      matchedSections.push(picked.matchedKey);
      sourceItems.push(...picked.items.map((item) => ({ ...item, section: picked.matchedKey })));
    }
  } else if (section) {
    const picked = pickShopbackSection(category?.item, section);
    matchedSections = picked.matchedKey ? [picked.matchedKey] : [];
    sourceItems = picked.items.map((item) => ({ ...item, section: picked.matchedKey || null }));
  } else {
    sourceItems = category?.item?.merchants || [];
  }

  const items = normalizeSortedItems(sourceItems, "auto")
    .filter((item, index, rows) => rows.findIndex((row) => row.name === item.name) === index)
    .filter((item) => {
      if (item.normalized.kind === "percent") return (item.normalized.value ?? 0) >= minPercent;
      if (item.normalized.kind === "dollar") return (item.normalized.value ?? 0) >= minDollar;
      return false;
    })
    .slice(0, limit);

  process.stdout.write(`${JSON.stringify({
    ok: true,
    category: slug,
    section: requestedSections.length > 0 ? null : (section || null),
    sections: matchedSections,
    thresholds: { minPercent, minDollar },
    count: items.length,
    items,
  }, null, 2)}\n`);
}
