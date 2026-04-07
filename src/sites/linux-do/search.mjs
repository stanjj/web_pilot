import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectLinuxDoPage, getLinuxDoPort, getLinuxDoUrl } from "./common.mjs";

export async function runLinuxDoSearch(flags) {
  const keyword = String(flags.keyword || "").trim();
  const limit = Math.min(Number(flags.limit ?? 20), 50);
  const port = getLinuxDoPort(flags.port);
  if (!keyword) throw new Error("Missing required --keyword");
  const { client } = await connectLinuxDoPage(port);
  try {
    await navigate(client, getLinuxDoUrl(), 2500);
    const result = await evaluate(client, `
      (async () => {
        try {
          const params = new URLSearchParams({ q: ${JSON.stringify(keyword)} });
          const resp = await fetch('/search/query.json?' + params.toString(), { credentials: 'include' });
          const text = await resp.text();
          if (!resp.ok) return { ok: false, status: resp.status, body: text.slice(0, 300) };
          const data = JSON.parse(text);
          const items = (data?.topics || []).slice(0, ${Math.max(1, limit)}).map((topic, index) => ({
            rank: index + 1,
            title: topic.fancy_title || topic.title || '',
            replies: topic.posts_count ?? 0,
            views: topic.views ?? 0,
            url: topic.slug ? ('https://linux.do/t/' + topic.slug + '/' + topic.id) : ''
          }));
          return { ok: true, items };
        } catch (error) {
          return { ok: false, status: null, body: String(error) };
        }
      })()
    `);
    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({ ok: false, keyword, status: result?.status ?? null, message: "linux.do search request failed.", body: result?.body || "" }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`${JSON.stringify({ ok: true, keyword, count: result.items?.length || 0, items: result.items || [] }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
