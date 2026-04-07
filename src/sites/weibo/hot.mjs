import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectWeiboPage, getWeiboPort, getWeiboUrl } from "./common.mjs";

export async function runWeiboHot(flags) {
  const limit = Math.min(Number(flags.limit ?? 30), 50);
  const port = getWeiboPort(flags.port);
  const { client } = await connectWeiboPage(port);

  try {
    await navigate(client, getWeiboUrl(), 2500);

    const result = await evaluate(client, `
      (async () => {
        const count = ${Number.isFinite(limit) ? Math.max(1, limit) : 30};
        try {
          const resp = await fetch('/ajax/statuses/hot_band', { credentials: 'include' });
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

          if (!data?.ok) {
            return {
              ok: false,
              status: resp.status,
              needsLogin: false,
              body: text.slice(0, 300)
            };
          }

          const bandList = data?.data?.band_list || [];
          const items = bandList.slice(0, count).map((item, index) => ({
            rank: item?.realpos || (index + 1),
            word: item?.word || '',
            hotValue: item?.num ?? 0,
            category: item?.category || '',
            label: item?.label_name || '',
            url: item?.word ? ('https://s.weibo.com/weibo?q=' + encodeURIComponent('#' + item.word + '#')) : ''
          }));

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
          ? "Weibo hot requires a logged-in session in the shared agent browser."
          : "Weibo hot request failed.",
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
