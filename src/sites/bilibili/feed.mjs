import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectBilibiliPage, getBilibiliPort, getBilibiliUrl } from "./common.mjs";

function stripHtml(value) {
  return String(value || "").replace(/<[^>]+>/g, "").trim();
}

export async function runBilibiliFeed(flags) {
  const limit = Math.min(Number(flags.limit ?? 20), 30);
  const type = String(flags.type ?? "all").trim().toLowerCase();
  const port = getBilibiliPort(flags.port);
  const { client } = await connectBilibiliPage(port);

  try {
    await navigate(client, getBilibiliUrl(), 2500);
    const result = await evaluate(client, `
      (async () => {
        const filter = ${JSON.stringify(type)};
        const typeMap = { all: 'all', video: 'video', article: 'article' };
        const params = new URLSearchParams({
          timezone_offset: '-480',
          type: typeMap[filter] || 'all',
          page: '1'
        });
        try {
          const resp = await fetch('https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/all?' + params.toString(), { credentials: 'include' });
          const text = await resp.text();
          const data = JSON.parse(text);
          if (data?.code === -101) {
            return { ok: false, needsLogin: true, body: text.slice(0, 300) };
          }
          const items = [];
          for (const item of (data?.data?.items || [])) {
            const modules = item.modules || {};
            const authorModule = modules.module_author || {};
            const dynamicModule = modules.module_dynamic || {};
            const major = dynamicModule.major || {};
            let title = '';
            let url = '';
            let itemType = item.type || '';

            if (major.archive) {
              title = major.archive.title || '';
              url = major.archive.jump_url ? ('https:' + major.archive.jump_url) : '';
              itemType = 'video';
            } else if (major.article) {
              title = major.article.title || '';
              url = major.article.jump_url ? ('https:' + major.article.jump_url) : '';
              itemType = 'article';
            } else if (dynamicModule.desc) {
              title = dynamicModule.desc.text || '';
              url = item.id_str ? ('https://t.bilibili.com/' + item.id_str) : '';
              itemType = 'dynamic';
            }

            if (!title) continue;
            items.push({
              rank: items.length + 1,
              author: authorModule.name || '',
              title,
              type: itemType,
              url,
            });
            if (items.length >= ${Math.max(1, limit)}) break;
          }
          return { ok: true, items };
        } catch (error) {
          return { ok: false, body: String(error) };
        }
      })()
    `);

    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        type,
        needsLogin: Boolean(result?.needsLogin),
        message: result?.needsLogin
          ? "Bilibili feed requires a logged-in session in the shared agent browser."
          : "Bilibili feed request failed.",
        body: result?.body || "",
      }, null, 2)}\n`);
      process.exitCode = result?.needsLogin ? 2 : 1;
      return;
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      type,
      count: result.items?.length || 0,
      items: (result.items || []).map((item) => ({ ...item, title: stripHtml(item.title) })),
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
