import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectTwitterPage, getTwitterPort, getTwitterUrl } from "./common.mjs";

export async function runTwitterTrending(flags) {
  const limit = Number(flags.limit ?? 20);
  const port = getTwitterPort(flags.port);
  const { client } = await connectTwitterPage(port);

  try {
    await navigate(client, getTwitterUrl(), 3500);

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
          const resp = await fetch('/i/api/2/guide.json?include_page_configuration=true', {
            credentials: 'include',
            headers: {
              'x-twitter-active-user': 'yes',
              'x-csrf-token': csrfToken,
              authorization: 'Bearer ' + bearerToken
            }
          });
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
          return { ok: false, status: null, body: String(error) };
        }
      })()
    `);

    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        status: result?.status ?? null,
        needsLogin: Boolean(result?.needsLogin),
        message: result?.needsLogin
          ? "Twitter trending requires a logged-in session in the shared agent browser."
          : "Twitter trending request failed.",
        body: result?.body || "",
      }, null, 2)}\n`);
      process.exitCode = result?.needsLogin ? 2 : 1;
      return;
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      count: result.count,
      items: result.items || [],
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
