import { evaluate, navigate, insertText } from "../../core/cdp.mjs";
import { connectFeishuPage, getFeishuPort, getFeishuUrl } from "./common.mjs";

export async function runFeishuSearch(flags) {
  const query = String(flags.query || "").trim();
  const port = getFeishuPort(flags.port);
  if (!query) throw new Error("Missing required --query");
  const { client } = await connectFeishuPage(port);
  try {
    await navigate(client, getFeishuUrl(), 2500);
    const prep = await evaluate(client, `
      (() => {
        const input = document.querySelector('input[type="text"], input[placeholder*="搜索"], input[placeholder*="Search"]');
        if (!input) return { ok: false };
        input.focus();
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return { ok: true };
      })()
    `);
    if (prep?.ok) {
      await insertText(client, query);
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
    const items = await evaluate(client, `
      (() => Array.from(document.querySelectorAll('[role="option"], .search-result, .search-item, [data-testid*="search"]'))
        .slice(0, 20)
        .map((node, index) => ({
          index: index + 1,
          title: (node.innerText || node.textContent || '').replace(/\\s+/g, ' ').trim()
        }))
        .filter((item) => item.title))()
    `);
    process.stdout.write(`${JSON.stringify({ ok: true, query, count: items?.length || 0, items: items || [] }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
