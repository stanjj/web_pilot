import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectCodexPage, getCodexPort, getCodexUrl } from "./common.mjs";

export async function runCodexStatus(flags) {
  const port = getCodexPort(flags.port);
  const { client } = await connectCodexPage(port);

  try {
    await navigate(client, getCodexUrl(), 2500);
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
