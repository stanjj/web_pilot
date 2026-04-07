import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectPineifyPage, getPineifyPort, getPineifyUrl } from "./common.mjs";

export async function runPineifyStatus(flags) {
  const port = getPineifyPort(flags.port);
  const { client } = await connectPineifyPage(port);

  try {
    await navigate(client, getPineifyUrl(), 2500);
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
