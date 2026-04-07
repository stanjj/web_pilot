import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectRedditPage, getRedditPort, getRedditUrl } from "./common.mjs";

async function runPrivateListing(flags, endpoint, name) {
  const limit = Number(flags.limit ?? 15);
  const port = getRedditPort(flags.port);
  const { client } = await connectRedditPage(port);
  try {
    await navigate(client, getRedditUrl(), 2500);
    const result = await evaluate(client, `
      (async () => {
        try {
          const meResp = await fetch('/api/v1/me', { credentials: 'include' });
          const meText = await meResp.text();
          if (!meResp.ok) return { ok: false, needsLogin: true, body: meText.slice(0, 300) };
          const me = JSON.parse(meText);
          const username = me?.name || '';
          if (!username) return { ok: false, needsLogin: true, body: meText.slice(0, 300) };
          const resp = await fetch('/user/' + encodeURIComponent(username) + '/${endpoint}.json?limit=' + ${Number.isFinite(limit) ? Math.max(1, limit) : 15} + '&raw_json=1', { credentials: 'include' });
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
              url: row.permalink ? ('https://www.reddit.com' + row.permalink) : ''
            };
          });
          return { ok: true, username, items };
        } catch (error) {
          return { ok: false, status: null, body: String(error) };
        }
      })()
    `);
    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({ ok: false, needsLogin: Boolean(result?.needsLogin), status: result?.status ?? null, message: result?.needsLogin ? `Reddit ${name} requires a logged-in session.` : `Reddit ${name} request failed.`, body: result?.body || "" }, null, 2)}\n`);
      process.exitCode = result?.needsLogin ? 2 : 1;
      return;
    }
    process.stdout.write(`${JSON.stringify({ ok: true, username: result.username, count: result.items?.length || 0, items: result.items || [] }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}

export async function runRedditSaved(flags) {
  await runPrivateListing(flags, "saved", "saved");
}

export async function runRedditUpvoted(flags) {
  await runPrivateListing(flags, "upvoted", "upvoted");
}
