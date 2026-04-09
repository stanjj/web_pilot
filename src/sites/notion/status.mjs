import { evaluate } from "../../core/cdp.mjs";
import { connectNotionPage, getNotionPort } from "./common.mjs";
import { summarizeNotionPage } from "./helpers.mjs";

export async function runNotionStatus(flags) {
  const port = getNotionPort(flags.port);
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
    const result = summarizeNotionPage(snapshot);

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result;
  } finally {
    await client.close();
  }
}
