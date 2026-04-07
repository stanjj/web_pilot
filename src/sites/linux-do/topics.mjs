import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectLinuxDoPage, getLinuxDoPort, getLinuxDoUrl } from "./common.mjs";

async function runLinuxDoList(kind, flags) {
  const limit = Number(flags.limit ?? 20);
  const period = String(flags.period || "weekly").trim();
  const port = getLinuxDoPort(flags.port);
  const { client } = await connectLinuxDoPage(port);

  try {
    await navigate(client, getLinuxDoUrl(), 2500);

    const result = await evaluate(client, `
      (async () => {
        const limit = ${Number.isFinite(limit) ? Math.max(1, limit) : 20};
        const period = ${JSON.stringify(period)};
        const url = ${JSON.stringify(kind)} === 'hot'
          ? ('/top.json?period=' + encodeURIComponent(period))
          : '/latest.json';

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

          let data;
          try {
            data = JSON.parse(text);
          } catch (error) {
            return { ok: false, status: resp.status, body: text.slice(0, 300), error: String(error) };
          }

          const topics = data?.topic_list?.topics || [];
          const categories = data?.topic_list?.categories || data?.categories || [];
          const catMap = Object.fromEntries(categories.map((cat) => [cat.id, cat.name]));
          const items = topics.slice(0, limit).map((topic, index) => ({
            rank: index + 1,
            title: topic?.title || '',
            replies: Math.max((topic?.posts_count || 1) - 1, 0),
            views: topic?.views ?? 0,
            likes: topic?.like_count ?? 0,
            category: catMap[topic?.category_id] || String(topic?.category_id || ''),
            url: topic?.slug ? ('https://linux.do/t/' + topic.slug + '/' + topic.id) : ''
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
        kind,
        period: kind === "hot" ? period : null,
        status: result?.status ?? null,
        needsLogin: Boolean(result?.needsLogin),
        message: result?.needsLogin
          ? `linux.do ${kind} requires a logged-in session in the shared agent browser.`
          : `linux.do ${kind} request failed.`,
        body: result?.body || "",
      }, null, 2)}\n`);
      process.exitCode = result?.needsLogin ? 2 : 1;
      return;
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      kind,
      period: kind === "hot" ? period : null,
      count: result.count,
      items: result.items || [],
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}

export async function runLinuxDoHot(flags) {
  await runLinuxDoList("hot", flags);
}

export async function runLinuxDoLatest(flags) {
  await runLinuxDoList("latest", flags);
}
