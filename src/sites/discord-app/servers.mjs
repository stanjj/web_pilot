import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectDiscordPage, getDiscordPort, getDiscordUrl } from "./common.mjs";

export async function runDiscordServers(flags) {
  const port = getDiscordPort(flags.port);
  const { client } = await connectDiscordPage(port);
  try {
    await navigate(client, getDiscordUrl(), 2500);
    const items = await evaluate(client, `
      (() => Array.from(document.querySelectorAll('[data-list-item-id^="guildsnav"], nav [aria-label]'))
        .slice(0, 50)
        .map((node, index) => ({
          index: index + 1,
          title: node.getAttribute('aria-label') || (node.innerText || '').trim()
        }))
        .filter((item) => item.title))()
    `);
    process.stdout.write(`${JSON.stringify({ ok: true, count: items?.length || 0, items: items || [] }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
