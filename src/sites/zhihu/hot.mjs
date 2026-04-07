import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectZhihuPage, getZhihuPort, getZhihuUrl } from "./common.mjs";

export async function runZhihuHot(flags) {
  const limit = Number(flags.limit ?? 20);
  const port = getZhihuPort(flags.port);
  const { client } = await connectZhihuPage(port);

  try {
    await navigate(client, getZhihuUrl(), 2500);

    const result = await evaluate(client, `
      (async () => {
        const limit = ${Number.isFinite(limit) ? Math.max(1, limit) : 20};
        try {
          const resp = await fetch('https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total?limit=50', {
            credentials: 'include'
          });
          const text = await resp.text();
          if (!resp.ok) {
            return { ok: false, status: resp.status, body: text.slice(0, 300) };
          }

          let data;
          try {
            data = JSON.parse(text.replace(/("id"\\s*:\\s*)(\\d{16,})/g, '$1"$2"'));
          } catch (error) {
            return { ok: false, status: resp.status, body: text.slice(0, 300), error: String(error) };
          }

          const items = (data?.data || []).slice(0, limit).map((item, index) => {
            const target = item?.target || {};
            const questionId = target?.id == null ? '' : String(target.id);
            return {
              rank: index + 1,
              title: target?.title || '',
              heat: item?.detail_text || '',
              answers: target?.answer_count ?? 0,
              followers: target?.follower_count ?? 0,
              url: questionId ? ('https://www.zhihu.com/question/' + questionId) : ''
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
        message: "Zhihu hot request failed.",
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
