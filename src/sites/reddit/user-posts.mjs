import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectRedditPage, getRedditPort, getRedditUrl } from "./common.mjs";

async function runUserListing(flags, kind) {
  const username = String(flags.username || "").trim();
  const limit = Number(flags.limit ?? 15);
  const port = getRedditPort(flags.port);
  if (!username) {
    throw new Error("Missing required --username");
  }
  const { client } = await connectRedditPage(port);
  try {
    await navigate(client, getRedditUrl(), 2500);
    const result = await evaluate(client, `
      (async () => {
        try {
          const resp = await fetch('/user/' + encodeURIComponent(${JSON.stringify(username)}) + '/${kind}.json?limit=' + ${Number.isFinite(limit) ? Math.max(1, limit) : 15} + '&raw_json=1', { credentials: 'include' });
          const text = await resp.text();
          if (!resp.ok) return { ok: false, status: resp.status, body: text.slice(0, 300) };
          const data = JSON.parse(text);
          const items = (data?.data?.children || []).map((child, index) => {
            const row = child?.data || {};
            return ${kind === "comments" ? `({
              rank: index + 1,
              subreddit: row.subreddit_name_prefixed || '',
              score: row.score ?? null,
              body: String(row.body || '').replace(/\\s+/g, ' ').trim().slice(0, 300),
              url: row.permalink ? ('https://www.reddit.com' + row.permalink) : ''
            })` : `({
              rank: index + 1,
              title: row.title || '',
              subreddit: row.subreddit_name_prefixed || '',
              score: row.score ?? null,
              comments: row.num_comments ?? null,
              url: row.permalink ? ('https://www.reddit.com' + row.permalink) : ''
            })`};
          });
          return { ok: true, items };
        } catch (error) {
          return { ok: false, status: null, body: String(error) };
        }
      })()
    `);
    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({ ok: false, username, status: result?.status ?? null, message: "Reddit user listing request failed.", body: result?.body || "" }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`${JSON.stringify({ ok: true, username, count: result.items?.length || 0, items: result.items || [] }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}

export async function runRedditUserPosts(flags) {
  await runUserListing(flags, "submitted");
}

export async function runRedditUserComments(flags) {
  await runUserListing(flags, "comments");
}
