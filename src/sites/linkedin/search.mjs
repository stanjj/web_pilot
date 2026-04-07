import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectLinkedinPage, getLinkedinPort, getLinkedinUrl } from "./common.mjs";

export async function runLinkedinSearch(flags) {
  const query = String(flags.query || "").trim();
  const location = String(flags.location || "").trim();
  const limit = Math.min(Number(flags.limit ?? 10), 50);
  const port = getLinkedinPort(flags.port);

  if (!query) {
    throw new Error("Missing required --query");
  }

  const { client } = await connectLinkedinPage(port);

  try {
    await navigate(client, getLinkedinUrl(query, location), 4500);
    const result = await evaluate(client, `
      (() => {
        const limit = ${Number.isFinite(limit) ? Math.max(1, limit) : 10};
        const cards = Array.from(document.querySelectorAll('li, div'))
          .filter((node) =>
            node.querySelector?.('a[href*="/jobs/view/"]') &&
            node.querySelector?.('.base-search-card__title, .job-card-list__title, h3')
          );

        const seen = new Set();
        const items = [];

        for (const card of cards) {
          if (items.length >= limit) break;
          const link = card.querySelector('a[href*="/jobs/view/"]');
          const href = link?.href || '';
          if (!href || seen.has(href)) continue;
          seen.add(href);

          const title =
            card.querySelector('.base-search-card__title, .job-card-list__title, h3')?.textContent?.trim()
            || '';
          if (!title) continue;

          const company =
            card.querySelector('.base-search-card__subtitle, .artdeco-entity-lockup__subtitle, h4')?.textContent?.trim()
            || '';
          const loc =
            card.querySelector('.job-search-card__location, .job-card-container__metadata-wrapper, .base-search-card__metadata')?.textContent?.trim()
            || '';
          const listed =
            card.querySelector('time')?.getAttribute('datetime')
            || card.querySelector('time')?.textContent?.trim()
            || '';

          items.push({
            rank: items.length + 1,
            title,
            company,
            location: loc,
            listed,
            url: href
          });
        }

        return {
          ok: items.length > 0,
          count: items.length,
          items,
          text: (document.body.innerText || '').slice(0, 500),
          href: location.href
        };
      })()
    `);

    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        query,
        location,
        status: null,
        message: "LinkedIn search request failed.",
        body: result?.text || "",
        href: result?.href || "",
      }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      query,
      location: location || null,
      count: result.count,
      items: result.items || [],
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
