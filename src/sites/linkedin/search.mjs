import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectLinkedinPage, getLinkedinPort, getLinkedinUrl } from "./common.mjs";
import { summarizeLinkedinPage } from "./helpers.mjs";

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
    await navigate(client, getLinkedinUrl(query, location), 6500);
    const result = await evaluate(client, `
      (() => {
        const limit = ${Number.isFinite(limit) ? Math.max(1, limit) : 10};
        const seen = new Set();
        const items = [];
        const jobLinks = Array.from(document.querySelectorAll('a[href*="/jobs/view/"]'));

        for (const link of jobLinks) {
          if (items.length >= limit) break;
          const href = link?.href || '';
          if (!href || seen.has(href)) continue;
          seen.add(href);

          const card =
            link.closest('li')
            || link.closest('[data-occludable-job-id]')
            || link.closest('.job-card-container')
            || link.parentElement
            || document.body;

          const cleanText = (value) => (value || '').replace(/\\s+/g, ' ').trim();

          const title =
            cleanText(link.getAttribute('aria-label'))
            || cleanText(link.querySelector('strong')?.textContent)
            || cleanText(link.textContent);
          if (!title) continue;

          const company =
            cleanText(card.querySelector('.base-search-card__subtitle, .artdeco-entity-lockup__subtitle, .job-card-container__primary-description, h4')?.textContent)
            || '';
          const loc =
            cleanText(card.querySelector('.job-search-card__location, .job-card-container__metadata-wrapper, .job-card-container__metadata-item, .base-search-card__metadata, .artdeco-entity-lockup__caption')?.textContent)
            || '';
          const listed =
            card.querySelector('time')?.getAttribute('datetime')
            || cleanText(card.querySelector('time')?.textContent)
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
          count: items.length,
          items,
          url: location.href,
          title: document.title,
          bodyText: (document.body.innerText || '').slice(0, 1200),
          hasGlobalNav: Boolean(document.querySelector('header nav, .global-nav, [data-test-global-nav-link], [data-control-name="nav.settings"]')),
          hasSearchBox: Boolean(document.querySelector('input[placeholder*="Search"], input[aria-label*="Search"]')),
          currentUserName: Array.from(document.querySelectorAll('a[href*="/in/"]'))
            .find((node) => /me|profile|view profile/i.test((node.getAttribute('aria-label') || node.textContent || '').trim()))
            ?.textContent || '',
          currentUserUrl: Array.from(document.querySelectorAll('a[href*="/in/"]'))
            .find((node) => /me|profile|view profile/i.test((node.getAttribute('aria-label') || node.textContent || '').trim()))
            ?.href || ''
        };
      })()
    `);

    const session = summarizeLinkedinPage(result);

    if (!session.ok) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        query,
        location,
        needsLogin: true,
        message: session.message,
        url: session.url,
        title: session.title,
        currentUser: session.currentUser,
      }, null, 2)}\n`);
      process.exitCode = 2;
      return;
    }

    const payload = {
      ok: true,
      query,
      location: location || null,
      count: result.count,
      items: result.items || [],
      currentUser: session.currentUser,
    };

    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return payload;
  } finally {
    await client.close();
  }
}
