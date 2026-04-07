import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectDiscordPage, getDiscordPort, getDiscordUrl } from "./common.mjs";

export async function runDiscordChannels(flags) {
  const port = getDiscordPort(flags.port);
  const { client } = await connectDiscordPage(port);
  try {
    await navigate(client, getDiscordUrl(), 2500);
    const items = await evaluate(client, `
      (() => Array.from(document.querySelectorAll('[role="treeitem"], [data-list-item-id*="channels"]'))
        .slice(0, 100)
        .map((node, index) => ({
          index: index + 1,
          title: (node.innerText || node.textContent || '').replace(/\\s+/g, ' ').trim()
        }))
        .filter((item) => item.title))()
    `);
    process.stdout.write(`${JSON.stringify({ ok: true, count: items?.length || 0, items: items || [] }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
