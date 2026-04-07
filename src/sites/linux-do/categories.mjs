import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectLinuxDoPage, getLinuxDoPort, getLinuxDoUrl } from "./common.mjs";

export async function runLinuxDoCategories(flags) {
  const limit = Math.min(Number(flags.limit ?? 20), 50);
  const port = getLinuxDoPort(flags.port);
  const { client } = await connectLinuxDoPage(port);
  try {
    await navigate(client, getLinuxDoUrl(), 2500);
    const result = await evaluate(client, `
      (async () => {
        try {
          const resp = await fetch('/categories.json', { credentials: 'include' });
          const text = await resp.text();
          if (!resp.ok) return { ok: false, status: resp.status, body: text.slice(0, 300) };
          const data = JSON.parse(text);
          const items = (data?.category_list?.categories || data?.categories || []).slice(0, ${Math.max(1, limit)}).map((cat) => ({
            id: cat.id,
            name: cat.name || '',
            slug: cat.slug || '',
            topics: cat.topic_count ?? 0,
            posts: cat.post_count ?? 0
          }));
          return { ok: true, items };
        } catch (error) {
          return { ok: false, status: null, body: String(error) };
        }
      })()
    `);
    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({ ok: false, status: result?.status ?? null, message: "linux.do categories request failed.", body: result?.body || "" }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`${JSON.stringify({ ok: true, count: result.items?.length || 0, items: result.items || [] }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
