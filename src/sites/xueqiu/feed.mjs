import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectXueqiuPage, getXueqiuPort, getXueqiuUrl } from "./common.mjs";

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

export async function runXueqiuFeed(flags) {
  const page = Math.max(1, Number(flags.page ?? 1));
  const limit = Math.min(Number(flags.limit ?? 20), 50);
  const port = getXueqiuPort(flags.port);
  const { client } = await connectXueqiuPage(port);

  try {
    await navigate(client, getXueqiuUrl(), 2500);

    const result = await evaluate(client, `
      (async () => {
        const page = ${Number.isFinite(page) ? page : 1};
        const count = ${Number.isFinite(limit) ? Math.max(1, limit) : 20};
        const url = 'https://xueqiu.com/v4/statuses/home_timeline.json?page=' + page + '&count=' + count;

        try {
          const resp = await fetch(url, { credentials: 'include' });
          const text = await resp.text();
          if (!resp.ok) {
            return {
              ok: false,
              status: resp.status,
              needsLogin: resp.status === 401 || resp.status === 403,
              body: text.slice(0, 300)
            };
          }

          const data = JSON.parse(text);
          const list = data?.home_timeline || data?.list || [];
          const items = list.map((item) => {
            const user = item?.user || {};
            return {
              id: item?.id || '',
              author: user?.screen_name || '',
              text: item?.description || '',
              likes: item?.fav_count ?? 0,
              replies: item?.reply_count ?? 0,
              retweets: item?.retweet_count ?? 0,
              createdAt: item?.created_at ? new Date(item.created_at).toISOString() : null,
              url: user?.id && item?.id ? ('https://xueqiu.com/' + user.id + '/' + item.id) : ''
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
        page,
        status: result?.status ?? null,
        needsLogin: Boolean(result?.needsLogin),
        message: result?.needsLogin
          ? "Xueqiu feed requires a logged-in session in the shared agent browser."
          : "Xueqiu feed request failed.",
        body: result?.body || "",
      }, null, 2)}\n`);
      process.exitCode = result?.needsLogin ? 2 : 1;
      return;
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      page,
      count: result.count,
      items: (result.items || []).slice(0, limit).map((item, index) => ({
        rank: index + 1,
        author: item.author,
        text: stripHtml(item.text).slice(0, 160),
        likes: item.likes,
        replies: item.replies,
        retweets: item.retweets,
        createdAt: item.createdAt,
        url: item.url,
      })),
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
