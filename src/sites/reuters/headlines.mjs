import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectReutersPage, getReutersPort, getReutersUrl } from "./common.mjs";

export async function runReutersHeadlines(flags) {
  const limit = Math.min(Number(flags.limit ?? 15), 40);
  const section = String(flags.section || "world").trim().toLowerCase();
  const port = getReutersPort(flags.port);
  const { client } = await connectReutersPage(port);

  try {
    const sectionUrl = `https://www.reuters.com/${encodeURIComponent(section)}/`;
    await navigate(client, sectionUrl, 3000);

    const result = await evaluate(client, `
      (() => {
        const count = ${Number.isFinite(limit) ? Math.max(1, limit) : 15};

        // Try structured article elements first
        const articleEls = document.querySelectorAll(
          'article, [data-testid*="story"], [class*="story-card"], [class*="MediaStory"]'
        );
        const items = [];

        for (const el of articleEls) {
          if (items.length >= count) break;
          const link = el.querySelector('a[href*="/"]');
          const heading = el.querySelector('h2, h3, [data-testid*="Heading"]');
          const title = heading?.textContent?.trim() || link?.textContent?.trim() || '';
          const href = link?.href || '';
          const timeEl = el.querySelector('time');
          const time = timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim() || '';

          if (title && !items.some((i) => i.title === title)) {
            items.push({
              rank: items.length + 1,
              title,
              time: time ? time.split('T')[0] : '',
              url: href.startsWith('http') ? href : (href ? 'https://www.reuters.com' + href : ''),
            });
          }
        }

        // Fallback: parse links from the page
        if (items.length === 0) {
          const links = document.querySelectorAll('a[href*="/${encodeURIComponent(section)}/"]');
          for (const link of links) {
            if (items.length >= count) break;
            const title = link.textContent?.trim() || '';
            if (title.length > 20 && !items.some((i) => i.title === title)) {
              items.push({
                rank: items.length + 1,
                title,
                time: '',
                url: link.href || '',
              });
            }
          }
        }

        return { ok: items.length > 0, count: items.length, section: ${JSON.stringify(section)}, items };
      })()
    `);

    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        section,
        message: "Reuters headlines extraction returned no results.",
      }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
