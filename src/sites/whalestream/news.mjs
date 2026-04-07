import { evaluate, navigate } from "../../core/cdp.mjs";
import {
  connectWhaleStreamPage,
  getWhaleStreamNewsUrl,
  getWhaleStreamPort,
} from "./common.mjs";

export async function runWhaleStreamNews(flags) {
  const limit = Math.min(Number(flags.limit ?? 20), 50);
  const port = getWhaleStreamPort(flags.port);
  const { client } = await connectWhaleStreamPage(port);

  try {
    await navigate(client, getWhaleStreamNewsUrl(), 3500);

    const result = await evaluate(client, `
      (() => {
        const count = ${Number.isFinite(limit) ? Math.max(1, limit) : 20};
        const cards = [...document.querySelectorAll('a[href*="/news/"]')]
          .map((anchor) => {
            const card = anchor.parentElement?.parentElement?.parentElement || anchor.closest('div');
            const containers = [card, card?.parentElement, card?.parentElement?.parentElement].filter(Boolean);
            const title = anchor.querySelector('h1, h2, h3, h4, h5, h6')?.textContent?.trim()
              || anchor.getAttribute('title')
              || anchor.textContent?.trim()
              || '';
            const summary = containers
              .flatMap((container) => [...container.querySelectorAll('p')])
              .map((paragraph) => paragraph.textContent?.trim() || '')
              .find((text) => text && text !== title && text.length > 20) || '';
            const source = containers
              .flatMap((container) => [...container.querySelectorAll('p')])
              .map((paragraph) => paragraph.textContent?.trim() || '')
              .find((text) => /^[A-Za-z0-9 .&-]{2,30}$/.test(text)) || '';
            const time = containers
              .flatMap((container) => [...container.querySelectorAll('time')])
              .map((timeNode) => timeNode.textContent?.trim() || '')
              .find(Boolean) || '';
            const tickers = [...(card?.querySelectorAll('button') || [])]
              .map((button) => button.textContent?.trim() || '')
              .filter((text) => /^[A-Z]{1,5}$/.test(text))
              .filter((text, index, list) => list.indexOf(text) === index)
              .slice(0, 5);

            return {
              url: anchor.href || '',
              title,
              summary,
              source,
              time,
              tickers,
            };
          })
          .filter((item) => item.url.startsWith('https://www.whalestream.com/news/'))
          .filter((item) => item.title)
          .filter((item, index, list) => list.findIndex((entry) => entry.url === item.url) === index)
          .slice(0, count)
          .map((item, index) => ({
            rank: index + 1,
            ...item,
          }));

        return {
          ok: true,
          pageTitle: document.title,
          pageUrl: location.href,
          count: cards.length,
          items: cards,
        };
      })()
    `);

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
