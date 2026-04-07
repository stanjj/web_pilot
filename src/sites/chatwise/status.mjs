import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectChatwisePage, getChatwisePort, getChatwiseUrl } from "./common.mjs";

export async function runChatwiseStatus(flags) {
  const port = getChatwisePort(flags.port);
  const { client } = await connectChatwisePage(port);

  try {
    await navigate(client, getChatwiseUrl(), 2500);
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
