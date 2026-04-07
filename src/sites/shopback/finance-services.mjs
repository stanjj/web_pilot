import { fetchShopbackCategory } from "./category.mjs";
import { filterServices, normalizeSortedItems } from "./service-utils.mjs";

const FINANCE_TERMS = [
  "tax",
  "credit",
  "loan",
  "insurance",
  "bank",
  "finance",
  "financial",
  "wireless",
  "internet",
  "verizon",
  "at&t",
  "h&r",
];

const STRICT_FINANCE_TERMS = [
  "tax",
  "credit",
  "loan",
  "insurance",
  "bank",
  "finance",
  "financial",
  "h&r",
  "block",
];

export async function runShopbackFinanceServices(flags) {
  const limit = Math.min(Number(flags.limit ?? 5), 20);
  const strict = flags.strict === true;
  const mode = String(flags.sort || "auto").trim().toLowerCase();
  const extraTags = String(flags.tags || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const category = await fetchShopbackCategory({
    ...flags,
    slug: "digital-services",
    limit: "30",
  });

  const terms = [...new Set([
    ...(strict ? STRICT_FINANCE_TERMS : FINANCE_TERMS),
    ...extraTags,
  ])];

  let items = normalizeSortedItems(filterServices(category?.item?.merchants || [], terms), mode);
  if (mode === "percent-only") {
    items = items.filter((item) => item.normalized.kind === "percent");
  } else if (mode === "dollar-only") {
    items = items.filter((item) => item.normalized.kind === "dollar");
  }
  items = items.slice(0, limit);

  process.stdout.write(`${JSON.stringify({
    ok: true,
    category: "digital-services",
    strict,
    tags: terms,
    count: items.length,
    sort: mode,
    items,
  }, null, 2)}\n`);
}
