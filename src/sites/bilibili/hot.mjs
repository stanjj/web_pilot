import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectBilibiliPage, getBilibiliPort, getBilibiliUrl } from "./common.mjs";

export async function runBilibiliHot(flags) {
  const limit = Number(flags.limit ?? 20);
  const port = getBilibiliPort(flags.port);
  const { client } = await connectBilibiliPage(port);

  try {
    await navigate(client, getBilibiliUrl(), 2500);

    const result = await evaluate(client, `
      (async () => {
        const limit = ${Number.isFinite(limit) ? Math.max(1, limit) : 20};
        try {
          const resp = await fetch('https://api.bilibili.com/x/web-interface/popular?ps=' + limit + '&pn=1', {
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

          const items = (data?.data?.list || []).slice(0, limit).map((item, index) => ({
            rank: index + 1,
            title: item?.title || '',
            author: item?.owner?.name || '',
            play: item?.stat?.view ?? 0,
            danmaku: item?.stat?.danmaku ?? 0,
            bvid: item?.bvid || '',
            url: item?.bvid ? ('https://www.bilibili.com/video/' + item.bvid) : ''
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
        message: "Bilibili hot request failed.",
        body: result?.body || "",
      }, null, 2)}\n`);
      process.exitCode = 1;
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
