import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectWechatPage, getWechatPort, getWechatUrl } from "./common.mjs";

export async function runWechatChats(flags) {
  const port = getWechatPort(flags.port);
  const { client } = await connectWechatPage(port);
  try {
    await navigate(client, getWechatUrl(), 3500);
    const result = await evaluate(client, `
      (() => ({
        ok: true,
        status: 'Chats panel ready',
        title: document.title,
        chatCount: document.querySelectorAll('[role="listitem"], .chat_item, .conversation-item').length
      }))()
    `);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
