import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectDiscordPage, getDiscordPort, getDiscordUrl } from "./common.mjs";

export async function runDiscordRead(flags) {
  const port = getDiscordPort(flags.port);
  const { client } = await connectDiscordPage(port);
  try {
    await navigate(client, getDiscordUrl(), 2500);
    const items = await evaluate(client, `
      (() => Array.from(document.querySelectorAll('[id^="chat-messages"] [id^="message-content"], [data-list-item-id^="chat-messages"]'))
        .slice(-30)
        .map((node, index) => ({
          index: index + 1,
          text: (node.innerText || node.textContent || '').replace(/\\s+/g, ' ').trim()
        }))
        .filter((item) => item.text))()
    `);
    process.stdout.write(`${JSON.stringify({ ok: true, count: items?.length || 0, items: items || [] }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
