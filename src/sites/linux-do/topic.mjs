import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectLinuxDoPage, getLinuxDoPort, getLinuxDoUrl } from "./common.mjs";

export async function runLinuxDoTopic(flags) {
  const id = String(flags.id || "").trim();
  const port = getLinuxDoPort(flags.port);
  if (!id) throw new Error("Missing required --id");
  const { client } = await connectLinuxDoPage(port);
  try {
    await navigate(client, getLinuxDoUrl(), 2500);
    const result = await evaluate(client, `
      (async () => {
        try {
          const resp = await fetch('/t/' + encodeURIComponent(${JSON.stringify(id)}) + '.json', { credentials: 'include' });
          const text = await resp.text();
          if (!resp.ok) return { ok: false, status: resp.status, body: text.slice(0, 300) };
          const data = JSON.parse(text);
          return {
            ok: true,
            topic: {
              id: data.id,
              title: data.title || '',
              postsCount: data.posts_count ?? 0,
              views: data.views ?? 0,
              likeCount: data.like_count ?? 0,
              details: data.details || ''
            },
            posts: (data?.post_stream?.posts || []).slice(0, 20).map((post, index) => ({
              rank: index + 1,
              username: post.username || '',
              cooked: String(post.cooked || '').replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').trim(),
              likeCount: post.like_count ?? 0
            }))
          };
        } catch (error) {
          return { ok: false, status: null, body: String(error) };
        }
      })()
    `);
    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({ ok: false, id, status: result?.status ?? null, message: "linux.do topic request failed.", body: result?.body || "" }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`${JSON.stringify({ ok: true, topic: result.topic || {}, posts: result.posts || [] }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
