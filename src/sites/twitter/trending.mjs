import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectTwitterPage, getTwitterPort, getTwitterUrl } from "./common.mjs";
import { summarizeTwitterPage } from "./helpers.mjs";

export async function runTwitterTrending(flags) {
  const limit = Number(flags.limit ?? 20);
  const port = getTwitterPort(flags.port);
  const { client } = await connectTwitterPage(port);

  try {
    await navigate(client, getTwitterUrl(), 3500);
    const sessionSnapshot = await evaluate(client, `
      (() => {
        const profileLink = document.querySelector('[data-testid="AppTabBar_Profile_Link"], a[data-testid="SideNav_AccountSwitcher_Button"]')
          || Array.from(document.querySelectorAll('a[href^="/"]')).find((node) => /profile|account/i.test((node.getAttribute('aria-label') || '').trim()));
        const profileHref = profileLink?.getAttribute('href') || '';
        const currentHandle = profileHref.replace(/^\\//, '').split('/')[0];

        return {
          url: location.href,
          title: document.title,
          bodyText: (document.body?.innerText || '').slice(0, 1600),
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
        status: null,
        needsLogin: true,
        timedOut: false,
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
      (async () => {
        const limit = ${Number.isFinite(limit) ? Math.max(1, limit) : 20};
        const cookies = document.cookie.split(';').reduce((acc, chunk) => {
          const [key, ...rest] = chunk.trim().split('=');
          if (!key) return acc;
          acc[key] = rest.join('=');
          return acc;
        }, {});

        const csrfToken = cookies.ct0 || '';
        const bearerToken = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000);
          const resp = await fetch('/i/api/2/guide.json?include_page_configuration=true', {
            credentials: 'include',
            signal: controller.signal,
            headers: {
              'x-twitter-active-user': 'yes',
              'x-csrf-token': csrfToken,
              authorization: 'Bearer ' + bearerToken
            }
          }).finally(() => clearTimeout(timeoutId));
          const text = await resp.text();
          if (!resp.ok) {
            return {
              ok: false,
              status: resp.status,
              needsLogin: resp.status === 401 || resp.status === 403,
              body: text.slice(0, 300)
            };
          }

          let data;
          try {
            data = JSON.parse(text);
          } catch (error) {
            return { ok: false, status: resp.status, body: text.slice(0, 300), error: String(error) };
          }

          const instructions = data?.timeline?.instructions || [];
          const entries = instructions.flatMap((inst) => inst?.addEntries?.entries || inst?.entries || []);
          const trends = entries
            .filter((entry) => entry?.content?.timelineModule)
            .flatMap((entry) => entry.content.timelineModule.items || [])
            .map((item) => item?.item?.content?.trend)
            .filter(Boolean)
            .slice(0, limit)
            .map((trend, index) => ({
              rank: index + 1,
              topic: trend?.name || '',
              tweets: trend?.tweetCount || 'N/A'
            }));

          if (trends.length === 0) {
            return { ok: false, status: null, body: 'No trends found' };
          }

          return { ok: true, count: trends.length, items: trends };
        } catch (error) {
          return {
            ok: false,
            status: null,
            timedOut: error?.name === 'AbortError',
            body: String(error),
          };
        }
      })()
    `);

    if (!result?.ok) {
      const payload = {
        ok: false,
        status: result?.status ?? null,
        needsLogin: Boolean(result?.needsLogin),
        timedOut: Boolean(result?.timedOut),
        message: result?.needsLogin
          ? "Twitter trending hit a logged-in API gate. Refresh the X session in the shared agent browser and retry."
          : result?.timedOut
            ? "Twitter trending request timed out before Twitter returned data."
          : "Twitter trending request failed.",
        body: result?.body || "",
        currentUser: session.currentUser,
      };
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
      process.exitCode = result?.needsLogin ? 2 : 1;
      return payload;
    }

    const payload = {
      ok: true,
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
