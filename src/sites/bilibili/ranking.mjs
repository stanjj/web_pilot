import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectBilibiliPage, getBilibiliPort, getBilibiliUrl } from "./common.mjs";

export async function runBilibiliRanking(flags) {
  const limit = Math.min(Number(flags.limit ?? 20), 20);
  const port = getBilibiliPort(flags.port);
  const { client } = await connectBilibiliPage(port);

  try {
    await navigate(client, getBilibiliUrl(), 2500);
    const result = await evaluate(client, `
      (async () => {
        try {
          const resp = await fetch('https://api.bilibili.com/x/web-interface/ranking/v2?rid=0&type=all', {
            credentials: 'include'
          });
          const data = await resp.json();
          const list = data?.data?.list || [];
          return {
            ok: true,
            items: list.map((item, index) => ({
              rank: index + 1,
              title: item?.title || '',
              author: item?.owner?.name || '',
              score: item?.stat?.view ?? 0,
              url: item?.bvid ? ('https://www.bilibili.com/video/' + item.bvid) : ''
            }))
          };
        } catch (error) {
          return { ok: false, body: String(error) };
        }
      })()
    `);

    if (!result?.ok) {
      throw new Error(result?.body || "Bilibili ranking request failed.");
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      count: Math.min((result.items || []).length, limit),
      items: (result.items || []).slice(0, limit),
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
