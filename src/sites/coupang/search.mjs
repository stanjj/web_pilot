import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectCoupangPage, getCoupangPort } from "./common.mjs";

export async function runCoupangSearch(flags) {
  const query = String(flags.query || "").trim();
  const limit = Math.min(Number(flags.limit ?? 20), 50);
  const page = Math.max(Number(flags.page ?? 1), 1);
  const port = getCoupangPort(flags.port);

  if (!query) {
    throw new Error("Missing required --query");
  }

  const { client } = await connectCoupangPage(port);

  try {
    const url = `https://www.coupang.com/np/search?q=${encodeURIComponent(query)}&channel=user&page=${page}`;
    await navigate(client, url, 4500);

    const result = await evaluate(client, `
      (() => {
        const limit = ${Number.isFinite(limit) ? Math.max(1, limit) : 20};
        const parseNum = (value) => {
          const text = String(value || '').replace(/[^\\d.]/g, '');
          if (!text) return null;
          const num = Number(text);
          return Number.isFinite(num) ? num : null;
        };

        const cards = Array.from(document.querySelectorAll('li.search-product, a[href*="/vp/products/"], [data-product-id]'));
        const seen = new Set();
        const items = [];

        for (const node of cards) {
          if (items.length >= limit) break;
          const root = node.closest('li, div, article, section') || node;
          const link = root.querySelector('a[href*="/vp/products/"]') || (node.matches('a[href*="/vp/products/"]') ? node : null);
          const href = link?.href || '';
          if (!href || seen.has(href)) continue;
          seen.add(href);

          const title =
            root.querySelector('.name, .title, .product-name, .search-product-title, .item-title, [class*="productName"], [class*="product-name"]')?.textContent?.trim()
            || link?.getAttribute('title')
            || root.querySelector('img[alt]')?.getAttribute('alt')
            || '';
          if (!title) continue;

          const priceText =
            root.querySelector('.price-value, .sale-price, strong[class*="price"], [class*="salePrice"]')?.textContent?.trim()
            || '';
          const ratingText =
            root.querySelector('.rating, .star em, [class*="rating"], [class*="star"]')?.textContent?.trim()
            || '';
          const reviewText =
            root.querySelector('.rating-total-count, .count, .review-count, [class*="review"]')?.textContent?.trim()
            || '';

          items.push({
            rank: items.length + 1,
            title,
            price: priceText,
            rating: parseNum(ratingText),
            reviewCount: parseNum(reviewText),
            url: href
          });
        }

        return {
          ok: items.length > 0,
          count: items.length,
          items,
          title: document.title,
          href: location.href,
          text: (document.body.innerText || '').slice(0, 500)
        };
      })()
    `);

    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        query,
        page,
        status: null,
        message: "Coupang search request failed.",
        body: result?.text || "",
        href: result?.href || "",
      }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      query,
      page,
      count: result.count,
      items: result.items || [],
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
