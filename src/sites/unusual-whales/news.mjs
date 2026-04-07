import { evaluate, navigate } from "../../core/cdp.mjs";
import {
  connectUnusualWhalesPage,
  getUnusualWhalesNewsUrl,
  getUnusualWhalesPort,
} from "./common.mjs";

export async function runUnusualWhalesNews(flags) {
  const limit = Math.min(Number(flags.limit ?? 20), 50);
  const port = getUnusualWhalesPort(flags.port);
  const { client } = await connectUnusualWhalesPage(port);

  try {
    await navigate(client, getUnusualWhalesNewsUrl(), 3500);

    const result = await evaluate(client, `
      (() => {
        const count = ${Number.isFinite(limit) ? Math.max(1, limit) : 20};
        const items = [...document.querySelectorAll('a[href^="/news/"]')]
          .map((anchor) => {
            const title = anchor.querySelector('h1, h2, h3, h4, h5, h6')?.textContent?.trim()
              || anchor.textContent?.trim()
              || '';
            const fullText = anchor.textContent?.trim() || '';
            const dateText = fullText.match(/\\d{1,2}\\/\\d{1,2}\\/\\d{4}\\s+\\d{1,2}:\\d{2}\\s+[AP]M/i)?.[0] || '';

            return {
              title,
              date: dateText,
              url: anchor.href || '',
            };
          })
          .filter((item) => item.title && item.url)
          .filter((item, index, list) => list.findIndex((entry) => entry.url === item.url) === index)
          .slice(0, count)
          .map((item, index) => ({
            rank: index + 1,
            ...item,
          }));

        return {
          ok: true,
          url: location.href,
          title: document.title,
          count: items.length,
          items,
        };
      })()
    `);

    process.stdout.write(`${JSON.stringify({
      ok: true,
      pageTitle: result.title,
      pageUrl: result.url,
      count: result.count,
      items: result.items || [],
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
