import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectWechatPage, getWechatPort, getWechatUrl } from "./common.mjs";

export async function runWechatStatus(flags) {
  const port = getWechatPort(flags.port);
  const { client } = await connectWechatPage(port);

  try {
    await navigate(client, getWechatUrl(), 3500);
    const result = await evaluate(client, `
      (() => {
        const text = document.body.innerText || '';
        return {
          ok: true,
          status: 'Connected',
          url: location.href,
          title: document.title,
          loggedInHint: !/scan|扫码|登录|login/i.test(text),
          needsQr: /scan|扫码/i.test(text)
        };
      })()
    `);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
