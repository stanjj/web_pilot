import { evaluate, pressKey, insertText } from "../../core/cdp.mjs";
import { connectNotionPage, getNotionPort } from "./common.mjs";
import { ensureNotionWorkspaceReady } from "./helpers.mjs";

export async function runNotionSearch(flags) {
  const query = String(flags.query || "").trim();
  const port = getNotionPort(flags.port);
  if (!query) throw new Error("Missing required --query");
  const { client } = await connectNotionPage(port);
  try {
    const snapshot = await evaluate(client, `
      (() => ({
        url: location.href,
        title: document.title,
        bodyText: (document.body?.innerText || '').slice(0, 1600),
        hasSidebar: Boolean(document.querySelector('[class*="sidebar"], .notion-sidebar-container')),
        hasWorkspaceFrame: Boolean(document.querySelector('.notion-frame, .notion-app-inner, [data-test-id="notion-app"]')),
        hasQuickFind: Boolean(document.querySelector('[role="dialog"] input, [placeholder*="Search"], [aria-label*="Search"], [aria-label*="搜索"]'))
      }))()
    `);
    ensureNotionWorkspaceReady(snapshot);
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
