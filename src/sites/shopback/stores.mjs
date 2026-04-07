import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectShopbackPage, getShopbackPort, getShopbackStoresUrl } from "./common.mjs";

export async function runShopbackStores(flags) {
  const keyword = String(flags.keyword ?? "").trim().toLowerCase();
  const limit = Math.min(Number(flags.limit ?? 20), 50);
  const port = getShopbackPort(flags.port);
  const categorySlugs = ["fashion", "travel", "electronics", "digital-services", "beauty"];
  const { client } = await connectShopbackPage(port);

  try {
    await navigate(client, getShopbackStoresUrl(), 4500);
    const result = await evaluate(client, `
      (() => {
        const keyword = ${JSON.stringify(keyword)};
        const unique = new Set();
        const categorySlugs = new Set(${JSON.stringify(categorySlugs)});
        const items = [...document.querySelectorAll('a[href^="https://www.shopback.com/"]')]
          .map((anchor) => {
            const href = anchor.href || '';
            const text = (anchor.textContent || '').replace(/\\s+/g, ' ').trim();
            if (!text) return null;
            if (/^https?:\\/\\//i.test(text)) return null;
            const slug = href.replace(/^https:\\/\\/www\\.shopback\\.com\\//i, '').split(/[?#]/)[0];
            if (!slug || slug.includes('/') || slug === 'all-stores') return null;
            if (categorySlugs.has(slug)) return null;
            return {
              name: text,
              slug,
              url: href,
            };
          })
          .filter(Boolean)
          .filter((item) => {
            const key = item.slug + '::' + item.name.toLowerCase();
            if (unique.has(key)) return false;
            unique.add(key);
            return true;
          })
          .filter((item) => !keyword || item.name.toLowerCase().includes(keyword) || item.slug.toLowerCase().includes(keyword));

        return {
          ok: true,
          count: items.length,
          items
        };
      })()
    `);

    process.stdout.write(`${JSON.stringify({
      ok: true,
      keyword: keyword || null,
      count: Math.min(result.count || 0, limit),
      items: (result.items || []).slice(0, limit).map((item, index) => ({
        rank: index + 1,
        name: item.name,
        slug: item.slug,
        url: item.url,
      })),
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
