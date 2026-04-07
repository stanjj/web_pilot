import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectV2exPage, getV2exPort, getV2exUrl } from "./common.mjs";

export async function runV2exMe(flags) {
  const port = getV2exPort(flags.port);
  const { client } = await connectV2exPage(port);
  try {
    await navigate(client, getV2exUrl(), 2500);
    const result = await evaluate(client, `
      (() => {
        const username = document.querySelector('a[href^="/member/"]')?.textContent?.trim() || '';
        const balanceLine = Array.from(document.querySelectorAll('.box .cell')).map((x) => x.textContent || '').find((text) => /铜币|银币|金币/.test(text)) || '';
        const notificationsLine = Array.from(document.querySelectorAll('a')).map((a) => a.textContent || '').find((text) => /提醒|未读/.test(text)) || '';
        const needsLogin = !username;
        return {
          ok: !needsLogin,
          needsLogin,
          item: {
            username,
            balanceLine,
            notificationsLine
          }
        };
      })()
    `);
    process.stdout.write(`${JSON.stringify({
      ok: Boolean(result?.ok),
      needsLogin: Boolean(result?.needsLogin),
      item: result?.item || {},
      message: result?.needsLogin ? "V2EX me requires a logged-in session." : "",
    }, null, 2)}\n`);
    if (result?.needsLogin) process.exitCode = 2;
  } finally {
    await client.close();
  }
}
