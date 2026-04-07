import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectGrokPage, getGrokPort, getGrokUrl } from "./common.mjs";

export async function runGrokStatus(flags) {
  const port = getGrokPort(flags.port);
  const { client } = await connectGrokPage(port);

  try {
    await navigate(client, getGrokUrl(), 2500);
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
