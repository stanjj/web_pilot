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

export async function runXueqiuHot(flags) {
  const limit = Math.min(Number(flags.limit ?? 20), 50);
  const port = getXueqiuPort(flags.port);
  const { client } = await connectXueqiuPage(port);

  try {
    await navigate(client, getXueqiuUrl(), 2500);

    const result = await evaluate(client, `
      (async () => {
        const url = 'https://xueqiu.com/statuses/hot/listV3.json?source=hot&page=1';

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
          const list = data?.list || [];
          const items = list.map((item, index) => {
            const user = item?.user || {};
            return {
              rank: index + 1,
              author: user?.screen_name || '',
              text: item?.description || '',
              likes: item?.fav_count ?? 0,
              replies: item?.reply_count ?? 0,
              retweets: item?.retweet_count ?? 0,
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
        status: result?.status ?? null,
        needsLogin: Boolean(result?.needsLogin),
        message: result?.needsLogin
          ? "Xueqiu hot requires a logged-in session in the shared agent browser."
          : "Xueqiu hot request failed.",
        body: result?.body || "",
      }, null, 2)}\n`);
      process.exitCode = result?.needsLogin ? 2 : 1;
      return;
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      count: Math.min(result.count || 0, limit),
      items: (result.items || []).slice(0, limit).map((item) => ({
        rank: item.rank,
        author: item.author,
        text: stripHtml(item.text).slice(0, 160),
        likes: item.likes,
        replies: item.replies,
        retweets: item.retweets,
        url: item.url,
      })),
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
