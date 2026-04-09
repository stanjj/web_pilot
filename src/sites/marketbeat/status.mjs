import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectMarketBeatPage, getMarketBeatPort, getMarketBeatUrl } from "./common.mjs";
import { summarizeMarketBeatPage } from "./helpers.mjs";

export async function runMarketBeatStatus(flags) {
  const port = getMarketBeatPort(flags.port);
  const { client } = await connectMarketBeatPage(port);

  try {
    await navigate(client, getMarketBeatUrl(), 2500);
    const snapshot = await evaluate(client, `
      (() => ({
        url: location.href,
        title: document.title,
        bodyText: (document.body?.innerText || '').slice(0, 1600)
      }))()
    `);
    const result = summarizeMarketBeatPage(snapshot);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result;
  } finally {
    await client.close();
  }
}
