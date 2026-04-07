import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectShopbackPage, getShopbackPort, getShopbackUrl } from "./common.mjs";

export async function runShopbackStatus(flags) {
  const port = getShopbackPort(flags.port);
  const { client } = await connectShopbackPage(port);

  try {
    await navigate(client, getShopbackUrl(), 3000);
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
