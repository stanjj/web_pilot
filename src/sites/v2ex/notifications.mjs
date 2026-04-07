import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectV2exPage, getV2exPort } from "./common.mjs";

export async function runV2exNotifications(flags) {
  const limit = Math.min(Number(flags.limit ?? 20), 30);
  const port = getV2exPort(flags.port);
  const { client } = await connectV2exPage(port);
  try {
    await navigate(client, "https://www.v2ex.com/notifications", 2500);
    const result = await evaluate(client, `
      (() => {
        const pageText = document.body?.innerText || '';
        const needsLogin = /登录|sign in/i.test(pageText) && !document.querySelector('.cell[id]');
        const rows = Array.from(document.querySelectorAll('.cell[id]')).slice(0, ${Math.max(1, limit)}).map((cell, index) => ({
          rank: index + 1,
          text: (cell.innerText || '').replace(/\\s+/g, ' ').trim(),
          url: cell.querySelector('a[href]')?.href || ''
        }));
        return { ok: !needsLogin, needsLogin, items: rows };
      })()
    `);
    process.stdout.write(`${JSON.stringify({
      ok: Boolean(result?.ok),
      needsLogin: Boolean(result?.needsLogin),
      count: result?.items?.length || 0,
      items: result?.items || [],
      message: result?.needsLogin ? "V2EX notifications requires a logged-in session." : "",
    }, null, 2)}\n`);
    if (result?.needsLogin) process.exitCode = 2;
  } finally {
    await client.close();
  }
}
