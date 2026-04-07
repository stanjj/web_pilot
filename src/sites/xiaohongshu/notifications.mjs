import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectXiaohongshuPage, getXiaohongshuPort, getXiaohongshuUrl } from "./common.mjs";

export async function runXiaohongshuNotifications(flags) {
  const type = String(flags.type || "mentions").trim();
  const limit = Math.min(Number(flags.limit ?? 20), 30);
  const port = getXiaohongshuPort(flags.port);
  const { client } = await connectXiaohongshuPage(port);
  try {
    await navigate(client, getXiaohongshuUrl(), 4000);
    const items = await evaluate(client, `
      (() => Array.from(document.querySelectorAll('[class*="notice"], [class*="notification"], [role="listitem"]'))
        .slice(0, ${Math.max(1, limit)})
        .map((node, index) => ({
          index: index + 1,
          text: (node.innerText || node.textContent || '').replace(/\\s+/g, ' ').trim()
        }))
        .filter((item) => item.text))()
    `);
    process.stdout.write(`${JSON.stringify({ ok: true, type, count: items?.length || 0, items: items || [] }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
