import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectRedditPage, getRedditPort, getRedditUrl } from "./common.mjs";

export async function runRedditHot(flags) {
  const subreddit = String(flags.subreddit || "").trim();
  const limit = Number(flags.limit ?? 20);
  const port = getRedditPort(flags.port);
  const { client } = await connectRedditPage(port);

  try {
    await navigate(client, getRedditUrl(), 2500);

    const result = await evaluate(client, `
      (async () => {
        const sub = ${JSON.stringify(subreddit)};
        const limit = ${Number.isFinite(limit) ? Math.max(1, limit) : 20};
        const path = sub ? ('/r/' + encodeURIComponent(sub) + '/hot.json') : '/hot.json';

        try {
          const resp = await fetch(path + '?limit=' + limit + '&raw_json=1', {
            credentials: 'include'
          });
          const text = await resp.text();
          if (!resp.ok) {
            return { ok: false, status: resp.status, body: text.slice(0, 300) };
          }

          let data;
          try {
            data = JSON.parse(text);
          } catch (error) {
            return { ok: false, status: resp.status, body: text.slice(0, 300), error: String(error) };
          }

          const items = (data?.data?.children || []).map((child, index) => {
            const row = child?.data || {};
            return {
              rank: index + 1,
              title: row.title || '',
              subreddit: row.subreddit_name_prefixed || '',
              score: row.score ?? null,
              comments: row.num_comments ?? null,
              author: row.author || '',
              url: row.permalink ? ('https://www.reddit.com' + row.permalink) : ''
            };
          });

          return { ok: true, count: items.length, items };
        } catch (error) {
          return { ok: false, status: null, body: String(error) };
        }
      })()
    `);

    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        subreddit,
        status: result?.status ?? null,
        message: "Reddit hot request failed.",
        body: result?.body || "",
      }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      subreddit: subreddit || null,
      count: result.count,
      items: result.items || [],
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
