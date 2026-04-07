import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectV2exPage, getV2exPort, getV2exUrl } from "./common.mjs";

export async function runV2exDaily(flags) {
  const port = getV2exPort(flags.port);
  const { client } = await connectV2exPage(port);

  try {
    await navigate(client, "https://www.v2ex.com/mission/daily", 2500);
    const result = await evaluate(client, `
      (() => {
        const pageText = document.body?.innerText || '';
        const redeemLink = Array.from(document.querySelectorAll('a')).find((a) => /领取|redeem/i.test(a.textContent || ''));
        const coinText = pageText.match(/当前账户余额[^\n]*/)?.[0] || '';
        const success = /已成功领取|每日登录奖励已领取/.test(pageText);
        const needsLogin = /登录|sign in/i.test(pageText) && !coinText;
        return {
          ok: !needsLogin,
          needsLogin,
          success,
          balanceLine: coinText,
          redeemUrl: redeemLink?.href || ''
        };
      })()
    `);

    process.stdout.write(`${JSON.stringify({
      ok: Boolean(result?.ok),
      needsLogin: Boolean(result?.needsLogin),
      success: Boolean(result?.success),
      balanceLine: result?.balanceLine || "",
      redeemUrl: result?.redeemUrl || "",
      message: result?.needsLogin ? "V2EX daily requires a logged-in session." : "",
    }, null, 2)}\n`);
    if (result?.needsLogin) process.exitCode = 2;
  } finally {
    await client.close();
  }
}
