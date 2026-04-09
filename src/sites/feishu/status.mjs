import { evaluate } from "../../core/cdp.mjs";
import { connectFeishuPage, getFeishuPort } from "./common.mjs";
import { summarizeFeishuPage } from "./helpers.mjs";

export async function runFeishuStatus(flags) {
  const port = getFeishuPort(flags.port);
  const { client } = await connectFeishuPage(port);

  try {
    const snapshot = await evaluate(client, `
      (() => ({
        url: location.href,
        title: document.title,
        bodyText: (document.body?.innerText || '').slice(0, 1600),
        hasAppShell: Boolean(document.querySelector('[data-testid], [role="navigation"], [class*="messenger"], [class*="suite"]')),
        hasSearchInput: Boolean(document.querySelector('input[type="text"], input[placeholder*="搜索"], input[placeholder*="Search"]'))
      }))()
    `);
    const result = summarizeFeishuPage(snapshot);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result;
  } finally {
    await client.close();
  }
}
