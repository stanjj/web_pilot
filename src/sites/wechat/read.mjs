import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectWechatPage, getWechatPort, getWechatUrl } from "./common.mjs";

export async function runWechatRead(flags) {
  const port = getWechatPort(flags.port);
  const { client } = await connectWechatPage(port);
  try {
    await navigate(client, getWechatUrl(), 3500);
    const result = await evaluate(client, `
      (() => {
        const title = document.querySelector('.chat-title, .title, header h1')?.textContent?.trim() || '';
        const messages = Array.from(document.querySelectorAll('.message, .msg, [data-testid*="message"], .message-item'))
          .slice(-30)
          .map((node, index) => ({
            index: index + 1,
            text: (node.innerText || node.textContent || '').replace(/\\s+/g, ' ').trim()
          }))
          .filter((item) => item.text);
        return { ok: true, title, count: messages.length, items: messages };
      })()
    `);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
