import { evaluate, navigate, pressKey, insertText } from "../../core/cdp.mjs";
import { connectNotionPage, getNotionPort, getNotionUrl } from "./common.mjs";

export async function runNotionSearch(flags) {
  const query = String(flags.query || "").trim();
  const port = getNotionPort(flags.port);
  if (!query) throw new Error("Missing required --query");
  const { client } = await connectNotionPage(port);
  try {
    await navigate(client, getNotionUrl(), 2500);
    await pressKey(client, "p", { code: "KeyP", modifiers: 2, windowsVirtualKeyCode: 80, nativeVirtualKeyCode: 80 });
    await new Promise((resolve) => setTimeout(resolve, 500));
    await insertText(client, query);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const items = await evaluate(client, `
      (() => Array.from(document.querySelectorAll('[role="option"], [class*="searchResult"], [class*="quick-find"] [role="button"]'))
        .slice(0, 20)
        .map((item, i) => ({ index: i + 1, title: (item.textContent || '').trim().substring(0, 120) })))()
    `);
    await pressKey(client, "Escape", { code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
    process.stdout.write(`${JSON.stringify({
      ok: true,
      query,
      count: items?.length || 0,
      items: items?.length ? items : [{ index: 0, title: `No results for "${query}"` }],
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
