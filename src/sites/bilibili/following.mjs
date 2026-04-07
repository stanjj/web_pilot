import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectBilibiliPage, getBilibiliPort, getBilibiliUrl } from "./common.mjs";

export async function runBilibiliFollowing(flags) {
  const page = Math.max(1, Number(flags.page ?? 1));
  const limit = Math.min(Number(flags.limit ?? 50), 50);
  const uid = String(flags.uid || "").trim();
  const port = getBilibiliPort(flags.port);
  const { client } = await connectBilibiliPage(port);

  try {
    await navigate(client, getBilibiliUrl(), 2500);
    const result = await evaluate(client, `
      (async () => {
        const inputUid = ${JSON.stringify(uid)};
        const pn = ${page};
        const ps = ${limit};
        try {
          let vmid = inputUid;
          if (!vmid) {
            const navResp = await fetch('https://api.bilibili.com/x/web-interface/nav', { credentials: 'include' });
            const navText = await navResp.text();
            const navData = JSON.parse(navText);
            if (navData?.code === -101) {
              return { ok: false, needsLogin: true, body: navText.slice(0, 300) };
            }
            vmid = String(navData?.data?.mid || '');
          }

          const resp = await fetch('https://api.bilibili.com/x/relation/followings?vmid=' + encodeURIComponent(vmid) + '&pn=' + pn + '&ps=' + ps + '&order=desc', { credentials: 'include' });
          const text = await resp.text();
          const data = JSON.parse(text);
          if (data?.code !== 0) {
            return { ok: false, body: text.slice(0, 300) };
          }
          const list = data?.data?.list || [];
          return {
            ok: true,
            uid: vmid,
            total: data?.data?.total ?? 0,
            items: list.map((u) => ({
              mid: u.mid,
              name: u.uname || '',
              sign: (u.sign || '').slice(0, 40),
              following: u.attribute === 6 ? '互相关注' : '已关注',
              fans: u.official_verify?.desc || '',
            }))
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
          ? "Bilibili following requires a logged-in session in the shared agent browser."
          : "Bilibili following request failed.",
        body: result?.body || "",
      }, null, 2)}\n`);
      process.exitCode = result?.needsLogin ? 2 : 1;
      return;
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      uid: result.uid,
      total: result.total,
      count: result.items?.length || 0,
      items: result.items || [],
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
