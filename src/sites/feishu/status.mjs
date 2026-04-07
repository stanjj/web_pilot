import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectFeishuPage, getFeishuPort, getFeishuUrl } from "./common.mjs";

export async function runFeishuStatus(flags) {
  const port = getFeishuPort(flags.port);
  const { client } = await connectFeishuPage(port);

  try {
    await navigate(client, getFeishuUrl(), 2500);
    const result = await evaluate(client, `
      (() => ({
        ok: true,
        status: 'Connected',
        url: location.href,
        title: document.title,
        loggedInHint: !/login|登录|扫码/i.test(document.body.innerText || '')
      }))()
    `);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
