import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectAntigravityPage, getAntigravityPort, getAntigravityUrl } from "./common.mjs";

export async function runAntigravityStatus(flags) {
  const port = getAntigravityPort(flags.port);
  const { client } = await connectAntigravityPage(port);

  try {
    await navigate(client, getAntigravityUrl(), 2500);
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
