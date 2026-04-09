import { evaluate, navigate } from "../../core/cdp.mjs";
import {
  connectMarketBeatPage,
  getMarketBeatHeadlinesUrl,
  getMarketBeatPort,
} from "./common.mjs";
import { ensureMarketBeatReady } from "./helpers.mjs";

export async function runMarketBeatNews(flags) {
  const limit = Math.min(Number(flags.limit ?? 20), 50);
  const port = getMarketBeatPort(flags.port);
  const { client } = await connectMarketBeatPage(port);

  try {
    await navigate(client, getMarketBeatHeadlinesUrl(), 3500);
    const snapshot = await evaluate(client, `
      (() => ({
        url: location.href,
        title: document.title,
        bodyText: (document.body?.innerText || '').slice(0, 1600)
      }))()
    `);
    ensureMarketBeatReady(snapshot);

    const result = await evaluate(client, `
      (() => {
        const count = ${Number.isFinite(limit) ? Math.max(1, limit) : 20};
        const heading = [...document.querySelectorAll('h1, h2, h3, h4')]
          .find((node) => (node.textContent || '').trim() === 'Latest Financial News');
        const section = heading?.closest('div, section, article')?.parentElement || heading?.closest('div, section, article');
        const links = section
          ? [...section.querySelectorAll('a[href]')]
          : [...document.querySelectorAll('a[href]')];

        const items = links
          .map((anchor) => {
            const url = anchor.href || '';
            const rawTitle = anchor.querySelector('img')?.nextElementSibling?.textContent?.trim()
              || anchor.querySelector('img + div')?.textContent?.trim()
              || anchor.textContent?.trim()
              || '';
            const timeText = anchor.querySelector('time')?.textContent?.trim()
              || anchor.textContent?.match(/\\b(?:\\d+\\s+(?:minute|hour|day|week|month|year)s?\\s+ago)\\b/i)?.[0]
              || '';
            const title = (timeText ? rawTitle.replace(timeText, '').trim() : rawTitle)
              .replace(/\\|\\s+[A-Z][a-z]+\\s+\\d{1,2},\\s+\\d{4}\\s+\\d{1,2}:\\d{2}[AP]M$/, '')
              .trim();
            return { url, title, time: timeText };
          })
          .filter((item) => item.url.startsWith('https://www.marketbeat.com/') && item.title)
          .filter((item) => !/All Financial News/i.test(item.title))
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
          count: items.length,
          items,
        };
      })()
    `);

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
