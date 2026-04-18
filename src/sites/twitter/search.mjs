import { evaluate, navigate } from "../../core/cdp.mjs";
import { getTwitterSearchUrl } from "./adapters.mjs";
import { connectTwitterPage, getTwitterPort } from "./common.mjs";
import { summarizeTwitterPage } from "./helpers.mjs";

export async function runTwitterSearch(flags) {
  const query = String(flags.query || "").trim();
  const limit = Number(flags.limit ?? 10);
  const port = getTwitterPort(flags.port);

  if (!query) {
    throw new Error("Missing required --query");
  }

  const { client } = await connectTwitterPage(port);

  try {
    await navigate(client, getTwitterSearchUrl(flags), 6000);
    const sessionSnapshot = await evaluate(client, `
      (() => {
        const profileLink = document.querySelector('[data-testid="AppTabBar_Profile_Link"], a[data-testid="SideNav_AccountSwitcher_Button"]')
          || Array.from(document.querySelectorAll('a[href^="/"]')).find((node) => /profile|account/i.test((node.getAttribute('aria-label') || '').trim()));
        const profileHref = profileLink?.getAttribute('href') || '';
        const currentHandle = profileHref.replace(/^\\//, '').split('/')[0];

        return {
          url: location.href,
          title: document.title,
          bodyText: (document.body?.innerText || '').slice(0, 1800),
          hasPrimaryColumn: Boolean(document.querySelector('[data-testid="primaryColumn"], main[role="main"]')),
          hasSearchInput: Boolean(document.querySelector('input[data-testid="SearchBox_Search_Input"], input[placeholder*="Search"]')),
          hasTweetComposer: Boolean(document.querySelector('[data-testid="tweetTextarea_0"], [data-testid="SideNav_NewTweet_Button"]')),
          currentUserName: profileLink?.getAttribute('aria-label') || profileLink?.textContent || '',
          currentUserHandle: currentHandle,
          currentUserUrl: profileHref ? new URL(profileHref, location.origin).href : '',
        };
      })()
    `);
    const session = summarizeTwitterPage(sessionSnapshot);
    if (!session.ok) {
      const blocked = {
        ok: false,
        query,
        needsLogin: true,
        message: session.message,
        url: session.url,
        title: session.title,
        currentUser: session.currentUser,
      };
      process.stdout.write(`${JSON.stringify(blocked, null, 2)}\n`);
      process.exitCode = 2;
      return blocked;
    }

    const result = await evaluate(client, `
      (() => {
        const limit = ${Number.isFinite(limit) ? Math.max(1, limit) : 10};
        const items = [];
        const seen = new Set();
        const tweets = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));

        for (const tweet of tweets) {
          if (items.length >= limit) break;
          const link = tweet.querySelector('a[href*="/status/"]');
          const url = link?.href || '';
          if (!url || seen.has(url)) continue;
          seen.add(url);

          const text = (tweet.querySelector('[data-testid="tweetText"]')?.innerText || '').trim();
          const author = (tweet.querySelector('[data-testid="User-Name"]')?.innerText || '').split('\\n')[0]?.trim() || '';
          const time = tweet.querySelector('time')?.getAttribute('datetime') || '';

          items.push({
            rank: items.length + 1,
            author,
            text,
            time,
            url,
          });
        }

        return { ok: items.length > 0, count: items.length, items };
      })()
    `);

    const payload = {
      ok: Boolean(result?.ok),
      query,
      count: result?.count ?? 0,
      items: result?.items || [],
      currentUser: session.currentUser,
    };
    if (!payload.ok) {
      payload.message = "Twitter/X search page loaded but no tweet results were detected.";
      process.exitCode = 1;
    }

    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return payload;
  } finally {
    await client.close();
  }
}
