import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectBilibiliPage, getBilibiliPort, getBilibiliUrl } from "./common.mjs";

export async function runBilibiliMe(flags) {
  const port = getBilibiliPort(flags.port);
  const { client } = await connectBilibiliPage(port);

  try {
    await navigate(client, getBilibiliUrl(), 2500);

    const result = await evaluate(client, `
      (async () => {
        try {
          const resp = await fetch('https://api.bilibili.com/x/web-interface/nav', { credentials: 'include' });
          const text = await resp.text();
          const data = JSON.parse(text);
          if (data?.code === -101) {
            return { ok: false, needsLogin: true, body: text.slice(0, 300) };
          }
          const info = data?.data || {};
          return {
            ok: true,
            item: {
              name: info?.uname || '',
              uid: info?.mid ?? null,
              level: info?.level_info?.current_level ?? null,
              coins: info?.money ?? null,
              followers: info?.wallet?.mid ?? null,
              following: info?.is_senior_member ?? null,
              vipLabel: info?.vip_label?.text || '',
            }
          };
        } catch (error) {
          return { ok: false, body: String(error) };
        }
      })()
    `);

    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        needsLogin: Boolean(result?.needsLogin),
        message: result?.needsLogin
          ? "Bilibili me requires a logged-in session in the shared agent browser."
          : "Bilibili me request failed.",
        body: result?.body || "",
      }, null, 2)}\n`);
      process.exitCode = result?.needsLogin ? 2 : 1;
      return;
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      item: result.item || {},
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
