import { fetchShopbackStore } from "./store.mjs";

export async function runShopbackSimilar(flags) {
  const result = await fetchShopbackStore(flags);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    store: result?.item?.name || "",
    url: result?.item?.url || "",
    count: result?.item?.similarStores?.length || 0,
    items: result?.item?.similarStores || [],
  }, null, 2)}\n`);
}
