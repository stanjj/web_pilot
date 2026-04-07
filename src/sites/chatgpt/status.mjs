import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectChatgptPage, getChatgptPort, getChatgptUrl } from "./common.mjs";

export async function runChatgptStatus(flags) {
  const port = getChatgptPort(flags.port);
  const { client } = await connectChatgptPage(port);

  try {
    await navigate(client, getChatgptUrl(), 2500);
    const result = await evaluate(client, `
      (() => ({
        ok: true,
        status: 'Connected',
        url: location.href,
        title: document.title
      }))()
    `);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
