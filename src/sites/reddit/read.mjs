import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectRedditPage, getRedditPort, getRedditUrl } from "./common.mjs";

function normalizePostPath(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const url = new URL(raw);
      return `${url.pathname.replace(/\/$/, "")}.json`;
    } catch {
      return "";
    }
  }
  const postId = raw.replace(/^t3_/, "");
  return `/comments/${postId}.json`;
}

export async function runRedditRead(flags) {
  const postId = String(flags.post_id || "").trim();
  const sort = String(flags.sort || "best").trim().toLowerCase();
  const limit = Number(flags.limit ?? 25);
  const depth = Number(flags.depth ?? 2);
  const replies = Number(flags.replies ?? 5);
  const maxLength = Math.max(100, Number(flags.max_length ?? 2000));
  const port = getRedditPort(flags.port);

  if (!postId) {
    throw new Error("Missing required --post_id");
  }

  const path = normalizePostPath(postId);
  if (!path) {
    throw new Error("Could not parse --post_id");
  }

  const { client } = await connectRedditPage(port);
  try {
    await navigate(client, getRedditUrl(), 2500);
    const result = await evaluate(client, `
      (async () => {
        function trimText(value, maxLength) {
          const text = String(value || '').replace(/\\s+/g, ' ').trim();
          return text.length > maxLength ? (text.slice(0, maxLength) + '…') : text;
        }

        function pickReplies(node, depth, replyLimit, maxLength) {
          if (depth <= 1) return [];
          const children = node?.data?.replies?.data?.children || [];
          return children
            .filter((child) => child?.kind === 't1')
            .sort((a, b) => (b?.data?.score || 0) - (a?.data?.score || 0))
            .slice(0, replyLimit)
            .map((child) => ({
              author: child?.data?.author || '',
              score: child?.data?.score ?? null,
              body: trimText(child?.data?.body || '', maxLength),
              replies: pickReplies(child, depth - 1, replyLimit, maxLength)
            }));
        }

        try {
          const params = new URLSearchParams({
            raw_json: '1',
            sort: ${JSON.stringify(sort)},
            limit: String(${Number.isFinite(limit) ? Math.max(1, limit) : 25}),
            depth: String(${Number.isFinite(depth) ? Math.max(1, depth) : 2})
          });
          const resp = await fetch(${JSON.stringify(path)} + '?' + params.toString(), { credentials: 'include' });
          const text = await resp.text();
          if (!resp.ok) return { ok: false, status: resp.status, body: text.slice(0, 300) };
          const data = JSON.parse(text);
          const post = data?.[0]?.data?.children?.[0]?.data || {};
          const comments = (data?.[1]?.data?.children || [])
            .filter((child) => child?.kind === 't1')
            .slice(0, ${Number.isFinite(limit) ? Math.max(1, limit) : 25})
            .map((child, index) => ({
              rank: index + 1,
              author: child?.data?.author || '',
              score: child?.data?.score ?? null,
              body: trimText(child?.data?.body || '', ${maxLength}),
              replies: pickReplies(child, ${Number.isFinite(depth) ? Math.max(1, depth) : 2}, ${Number.isFinite(replies) ? Math.max(0, replies) : 5}, ${maxLength})
            }));
          return {
            ok: true,
            post: {
              title: post.title || '',
              author: post.author || '',
              subreddit: post.subreddit_name_prefixed || '',
              score: post.score ?? null,
              comments: post.num_comments ?? null,
              url: post.permalink ? ('https://www.reddit.com' + post.permalink) : ''
            },
            comments
          };
        } catch (error) {
          return { ok: false, status: null, body: String(error) };
        }
      })()
    `);

    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({ ok: false, postId, status: result?.status ?? null, message: "Reddit read request failed.", body: result?.body || "" }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`${JSON.stringify({ ok: true, post: result.post || {}, comments: result.comments || [] }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
