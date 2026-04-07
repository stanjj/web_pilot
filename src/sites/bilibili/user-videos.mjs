import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectBilibiliPage, getBilibiliPort, getBilibiliUrl } from "./common.mjs";

export async function runBilibiliUserVideos(flags) {
  const uid = String(flags.uid ?? "").trim();
  const limit = Math.min(Number(flags.limit ?? 20), 50);
  const page = Math.max(1, Number(flags.page ?? 1));
  const order = String(flags.order ?? "pubdate").trim();
  const port = getBilibiliPort(flags.port);

  if (!uid) {
    throw new Error("Missing required flag: --uid");
  }

  const { client } = await connectBilibiliPage(port);

  try {
    await navigate(client, getBilibiliUrl(), 2500);
    const result = await evaluate(client, `
      (async () => {
        const uid = ${JSON.stringify(uid)};
        const pageNum = ${Number.isFinite(page) ? page : 1};
        const pageSize = ${Number.isFinite(limit) ? limit : 20};
        const order = ${JSON.stringify(order)};
        const url = 'https://api.bilibili.com/x/space/arc/search?mid=' + encodeURIComponent(uid)
          + '&pn=' + pageNum + '&ps=' + Math.min(pageSize, 50) + '&order=' + encodeURIComponent(order);

        try {
          const resp = await fetch(url, { credentials: 'include' });
          const data = await resp.json();
          const list = data?.data?.list?.vlist || [];
          return {
            ok: true,
            items: list.map((item, index) => ({
              rank: index + 1,
              title: item?.title || '',
              plays: item?.play ?? 0,
              likes: item?.like ?? 0,
              date: item?.created ? new Date(item.created * 1000).toISOString().slice(0, 10) : '',
              url: item?.bvid ? ('https://www.bilibili.com/video/' + item.bvid) : ''
            }))
          };
        } catch (error) {
          return { ok: false, body: String(error) };
        }
      })()
    `);

    if (!result?.ok) {
      throw new Error(result?.body || "Bilibili user-videos request failed.");
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      uid,
      count: Math.min((result.items || []).length, limit),
      items: (result.items || []).slice(0, limit),
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
