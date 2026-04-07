import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectBilibiliPage, getBilibiliPort, getBilibiliUrl } from "./common.mjs";

export async function runBilibiliDynamic(flags) {
  const limit = Math.min(Number(flags.limit ?? 15), 30);
  const port = getBilibiliPort(flags.port);
  const { client } = await connectBilibiliPage(port);

  try {
    await navigate(client, getBilibiliUrl(), 2500);

    const result = await evaluate(client, `
      (async () => {
        try {
          const resp = await fetch('https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/all', { credentials: 'include' });
          const text = await resp.text();
          const data = JSON.parse(text);
          if (data?.code === -101) {
            return { ok: false, needsLogin: true, body: text.slice(0, 300) };
          }
          const items = (data?.data?.items || []).slice(0, ${Math.max(1, limit)}).map((item) => {
            let message = '';
            if (item.modules?.module_dynamic?.desc?.text) {
              message = item.modules.module_dynamic.desc.text;
            } else if (item.modules?.module_dynamic?.major?.archive?.title) {
              message = item.modules.module_dynamic.major.archive.title;
            }
            return {
              id: item.id_str || '',
              author: item.modules?.module_author?.name || '',
              text: message,
              likes: item.modules?.module_stat?.like?.count ?? 0,
              url: item.id_str ? ('https://t.bilibili.com/' + item.id_str) : '',
            };
          });
          return { ok: true, items };
        } catch (error) {
          return { ok: false, body: String(error) };
        }
      })()
    `);

    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        needsLogin: Boolean(result?.needsLogin),
        message: result?.needsLogin
          ? "Bilibili dynamic requires a logged-in session in the shared agent browser."
          : "Bilibili dynamic request failed.",
        body: result?.body || "",
      }, null, 2)}\n`);
      process.exitCode = result?.needsLogin ? 2 : 1;
      return;
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      count: result.items?.length || 0,
      items: result.items || [],
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
