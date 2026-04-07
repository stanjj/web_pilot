import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectBilibiliPage, getBilibiliPort, getBilibiliUrl } from "./common.mjs";

function stripHtml(value) {
  return String(value || "").replace(/<[^>]+>/g, "").trim();
}

export async function runBilibiliSearch(flags) {
  const keyword = String(flags.keyword ?? "").trim();
  if (!keyword) {
    throw new Error("Missing required flag: --keyword");
  }

  const type = String(flags.type ?? "video").trim().toLowerCase();
  const page = Math.max(1, Number(flags.page ?? 1));
  const limit = Math.min(Number(flags.limit ?? 20), 20);
  const port = getBilibiliPort(flags.port);
  const { client } = await connectBilibiliPage(port);

  try {
    await navigate(client, getBilibiliUrl(), 2500);

    const result = await evaluate(client, `
      (async () => {
        const keyword = ${JSON.stringify(keyword)};
        const searchType = ${JSON.stringify(type === "user" ? "bili_user" : "video")};
        const pageNum = ${Number.isFinite(page) ? page : 1};
        const url = 'https://api.bilibili.com/x/web-interface/search/type?search_type=' + encodeURIComponent(searchType)
          + '&keyword=' + encodeURIComponent(keyword)
          + '&page=' + pageNum;

        try {
          const resp = await fetch(url, { credentials: 'include' });
          const data = await resp.json();
          const items = data?.data?.result || [];
          return {
            ok: true,
            items: items.map((item, index) => searchType === 'bili_user'
              ? {
                  rank: index + 1,
                  title: item?.uname || '',
                  author: item?.usign || '',
                  score: item?.fans ?? 0,
                  url: item?.mid ? ('https://space.bilibili.com/' + item.mid) : ''
                }
              : {
                  rank: index + 1,
                  title: item?.title || '',
                  author: item?.author || '',
                  score: item?.play ?? 0,
                  url: item?.bvid ? ('https://www.bilibili.com/video/' + item.bvid) : ''
                })
          };
        } catch (error) {
          return { ok: false, body: String(error) };
        }
      })()
    `);

    if (!result?.ok) {
      throw new Error(result?.body || "Bilibili search request failed.");
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      keyword,
      type,
      count: Math.min((result.items || []).length, limit),
      items: (result.items || []).slice(0, limit).map((item) => ({
        ...item,
        title: stripHtml(item.title),
        author: stripHtml(item.author),
      })),
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
