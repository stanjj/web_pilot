import { evaluate, navigate, insertText } from "../../core/cdp.mjs";
import { connectWechatPage, getWechatPort, getWechatUrl } from "./common.mjs";

export async function runWechatSearch(flags) {
  const query = String(flags.query || "").trim();
  const port = getWechatPort(flags.port);
  if (!query) throw new Error("Missing required --query");
  const { client } = await connectWechatPage(port);
  try {
    await navigate(client, getWechatUrl(), 3500);
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
    const result = await evaluate(client, `
      (() => {
        const items = Array.from(document.querySelectorAll('[role="option"], .search-item, .search-result, .contact_item'))
          .slice(0, 20)
          .map((node, index) => ({
            index: index + 1,
            title: (node.innerText || node.textContent || '').replace(/\\s+/g, ' ').trim()
          }))
          .filter((item) => item.title);
        return { ok: true, count: items.length, items };
      })()
    `);
    process.stdout.write(`${JSON.stringify({ ok: true, query, count: result?.count || 0, items: result?.items || [] }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
