import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectUnusualWhalesPage, getUnusualWhalesPort, getUnusualWhalesUrl } from "./common.mjs";

export async function runUnusualWhalesStatus(flags) {
  const port = getUnusualWhalesPort(flags.port);
  const { client } = await connectUnusualWhalesPage(port);

  try {
    await navigate(client, getUnusualWhalesUrl(), 2500);
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
