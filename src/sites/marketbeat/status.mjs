import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectMarketBeatPage, getMarketBeatPort, getMarketBeatUrl } from "./common.mjs";

export async function runMarketBeatStatus(flags) {
  const port = getMarketBeatPort(flags.port);
  const { client } = await connectMarketBeatPage(port);

  try {
    await navigate(client, getMarketBeatUrl(), 2500);
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
