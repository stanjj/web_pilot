import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectShopbackPage, getShopbackPort, getShopbackUrl } from "./common.mjs";

export async function runShopbackCategories(flags) {
  const limit = Math.min(Number(flags.limit ?? 20), 50);
  const port = getShopbackPort(flags.port);
  const { client } = await connectShopbackPage(port, {
    url: getShopbackUrl(),
    match: (target) => /shopback\.com\/?$/i.test(target.url),
  });

  try {
    await navigate(client, getShopbackUrl(), 3500);
    const result = await evaluate(client, `
      (() => {
        const categorySlugs = new Set(['fashion','travel','electronics','digital-services','beauty']);
        const unique = new Set();
        const items = Array.from(document.querySelectorAll('a[href^="https://www.shopback.com/"]'))
          .map((anchor) => {
            const href = anchor.href || '';
            const text = (anchor.textContent || '').replace(/\\s+/g, ' ').trim();
            const slug = href.replace(/^https:\\/\\/www\\.shopback\\.com\\//i, '').split(/[?#]/)[0];
            if (!text || !slug || slug.includes('/')) return null;
            if (!categorySlugs.has(slug)) return null;
            const key = slug;
            if (unique.has(key)) return null;
            unique.add(key);
            return { name: text, slug, url: href };
          })
          .filter(Boolean);
        return { ok: true, count: items.length, items };
      })()
    `);

    process.stdout.write(`${JSON.stringify({
      ok: true,
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
