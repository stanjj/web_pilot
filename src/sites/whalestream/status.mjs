import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectWhaleStreamPage, getWhaleStreamPort, getWhaleStreamUrl } from "./common.mjs";

export async function runWhaleStreamStatus(flags) {
  const port = getWhaleStreamPort(flags.port);
  const { client } = await connectWhaleStreamPage(port);

  try {
    await navigate(client, getWhaleStreamUrl(), 2500);
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
