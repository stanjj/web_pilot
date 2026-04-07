import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectCursorPage, getCursorPort, getCursorUrl } from "./common.mjs";

export async function runCursorStatus(flags) {
  const port = getCursorPort(flags.port);
  const { client } = await connectCursorPage(port);

  try {
    await navigate(client, getCursorUrl(), 2500);
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
