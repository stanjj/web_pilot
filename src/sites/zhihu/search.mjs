import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectZhihuPage, getZhihuPort, getZhihuUrl } from "./common.mjs";

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

export async function runZhihuSearch(flags) {
  const keyword = String(flags.keyword ?? "").trim();
  if (!keyword) {
    throw new Error("Missing required flag: --keyword");
  }

  const limit = Math.min(Number(flags.limit ?? 10), 20);
  const port = getZhihuPort(flags.port);
  const { client } = await connectZhihuPage(port);

  try {
    await navigate(client, getZhihuUrl(), 2500);

    const result = await evaluate(client, `
      (async () => {
        const keyword = ${JSON.stringify(keyword)};
        const limit = ${Number.isFinite(limit) ? Math.max(1, limit) : 10};
        const url = 'https://www.zhihu.com/api/v4/search_v3?q=' + encodeURIComponent(keyword) + '&t=general&offset=0&limit=' + limit;

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
          const items = (data?.data || [])
            .filter((item) => item?.type === 'search_result')
            .map((item, index) => {
              const obj = item?.object || {};
              const q = obj?.question || {};
              return {
                rank: index + 1,
                type: obj?.type || '',
                title: obj?.title || q?.name || '',
                excerpt: (obj?.excerpt || '').slice(0, 200),
                author: obj?.author?.name || '',
                votes: obj?.voteup_count ?? 0,
                url: obj?.type === 'answer'
                  ? ('https://www.zhihu.com/question/' + q.id + '/answer/' + obj.id)
                  : obj?.type === 'article'
                  ? ('https://zhuanlan.zhihu.com/p/' + obj.id)
                  : ('https://www.zhihu.com/question/' + obj.id)
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
        keyword,
        status: result?.status ?? null,
        needsLogin: Boolean(result?.needsLogin),
        message: result?.needsLogin
          ? "Zhihu search requires a logged-in session in the shared agent browser."
          : "Zhihu search request failed.",
        body: result?.body || "",
      }, null, 2)}\n`);
      process.exitCode = result?.needsLogin ? 2 : 1;
      return;
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      keyword,
      count: result.count,
      items: (result.items || []).map((item) => ({
        ...item,
        title: stripHtml(item.title),
        excerpt: stripHtml(item.excerpt).slice(0, 100),
      })),
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
