import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectWechatPage, getWechatPort, getWechatUrl } from "./common.mjs";
import { ensureWechatChatsReady } from "./helpers.mjs";

export async function runWechatChats(flags) {
  const port = getWechatPort(flags.port);
  const { client } = await connectWechatPage(port);
  try {
    await navigate(client, getWechatUrl(), 3500);
    const snapshot = await evaluate(client, `
      (() => {
        const text = document.body.innerText || '';
        return {
          url: location.href,
          title: document.title,
          bodyText: text.slice(0, 1600),
          hasChatShell: Boolean(document.querySelector('.main_inner, .chat_list, [role="navigation"]')),
          chatCount: document.querySelectorAll('[role="listitem"], .chat_item, .conversation-item').length
        };
      })()
    `);
    const summary = ensureWechatChatsReady(snapshot);
    const result = {
      ok: true,
      status: "Chats panel ready",
      title: summary.title,
      chatCount: summary.chatCount,
    };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result;
  } finally {
    await client.close();
  }
}
