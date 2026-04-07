export function pickShopbackSection(item, sectionName) {
  const sectionEntries = item?.sectionEntries || {};
  const normalized = String(sectionName || "").trim().toLowerCase();
  const matchedKey = Object.keys(sectionEntries).find((key) => key.toLowerCase() === normalized);
  return {
    matchedKey: matchedKey || null,
    items: matchedKey ? (sectionEntries[matchedKey] || []) : [],
  };
}
