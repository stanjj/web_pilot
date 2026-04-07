import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectLinuxDoPage, getLinuxDoPort, getLinuxDoUrl } from "./common.mjs";

export async function runLinuxDoCategory(flags) {
  const slug = String(flags.slug || "").trim();
  const id = String(flags.id || "").trim();
  const limit = Math.min(Number(flags.limit ?? 20), 50);
  const port = getLinuxDoPort(flags.port);
  if (!slug || !id) throw new Error("Missing required --slug or --id");
  const { client } = await connectLinuxDoPage(port);
  try {
    await navigate(client, getLinuxDoUrl(), 2500);
    const result = await evaluate(client, `
      (async () => {
        try {
          const resp = await fetch('/c/' + encodeURIComponent(${JSON.stringify(slug)}) + '/' + encodeURIComponent(${JSON.stringify(id)}) + '.json', { credentials: 'include' });
          const text = await resp.text();
          if (!resp.ok) return { ok: false, status: resp.status, body: text.slice(0, 300) };
          const data = JSON.parse(text);
          const items = (data?.topic_list?.topics || []).slice(0, ${Math.max(1, limit)}).map((topic, index) => ({
            rank: index + 1,
            title: topic.title || '',
            replies: Math.max((topic.posts_count || 1) - 1, 0),
            views: topic.views ?? 0,
            likes: topic.like_count ?? 0,
            url: topic.slug ? ('https://linux.do/t/' + topic.slug + '/' + topic.id) : ''
          }));
          return { ok: true, items };
        } catch (error) {
          return { ok: false, status: null, body: String(error) };
        }
      })()
    `);
    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({ ok: false, slug, id, status: result?.status ?? null, message: "linux.do category request failed.", body: result?.body || "" }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`${JSON.stringify({ ok: true, slug, id, count: result.items?.length || 0, items: result.items || [] }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
