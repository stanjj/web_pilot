import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectRedditPage, getRedditPort, getRedditUrl } from "./common.mjs";

export async function runRedditSubreddit(flags) {
  const name = String(flags.name || "").trim();
  const sort = String(flags.sort || "hot").trim().toLowerCase();
  const time = String(flags.time || "all").trim().toLowerCase();
  const limit = Number(flags.limit ?? 15);
  const port = getRedditPort(flags.port);

  if (!name) {
    throw new Error("Missing required --name");
  }

  const { client } = await connectRedditPage(port);
  try {
    await navigate(client, getRedditUrl(), 2500);
    const result = await evaluate(client, `
      (async () => {
        try {
          const params = new URLSearchParams({
            limit: String(${Number.isFinite(limit) ? Math.max(1, limit) : 15}),
            raw_json: '1'
          });
          const sort = ${JSON.stringify(sort)};
          if (sort === 'top' || sort === 'controversial') {
            params.set('t', ${JSON.stringify(time)});
          }
          const resp = await fetch('/r/' + encodeURIComponent(${JSON.stringify(name)}) + '/' + encodeURIComponent(sort) + '.json?' + params.toString(), { credentials: 'include' });
          const text = await resp.text();
          if (!resp.ok) return { ok: false, status: resp.status, body: text.slice(0, 300) };
          const data = JSON.parse(text);
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
      process.stdout.write(`${JSON.stringify({ ok: false, name, status: result?.status ?? null, message: "Reddit subreddit request failed.", body: result?.body || "" }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`${JSON.stringify({ ok: true, name, sort, time, count: result.count, items: result.items || [] }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
