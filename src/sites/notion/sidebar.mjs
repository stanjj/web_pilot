import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectNotionPage, getNotionPort, getNotionUrl } from "./common.mjs";

export async function runNotionSidebar(flags) {
  const port = getNotionPort(flags.port);
  const { client } = await connectNotionPage(port);
  try {
    await navigate(client, getNotionUrl(), 2500);
    const items = await evaluate(client, `
      (() => {
        const results = [];
        const selectors = [
          '[class*="sidebar"] [role="treeitem"]',
          '[class*="sidebar"] a',
          '.notion-sidebar [role="button"]',
          'nav [role="treeitem"]',
        ];
        for (const sel of selectors) {
          const nodes = document.querySelectorAll(sel);
          if (nodes.length > 0) {
            nodes.forEach((n) => {
              const text = (n.textContent || '').trim().substring(0, 100);
              if (text && text.length > 1) results.push({ index: results.length + 1, title: text });
            });
            break;
          }
        }
        return results;
      })()
    `);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      count: items?.length || 0,
      items: items?.length ? items : [{ index: 0, title: "No sidebar items found. Toggle the sidebar first." }],
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
