import { fetchShopbackStore } from "./store.mjs";

export async function runShopbackDeals(flags) {
  const result = await fetchShopbackStore(flags);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    store: result?.item?.name || "",
    url: result?.item?.url || "",
    count: result?.item?.deals?.length || 0,
    items: result?.item?.deals || [],
  }, null, 2)}\n`);
}
