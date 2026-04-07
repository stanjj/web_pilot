import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectRedditPage, getRedditPort, getRedditUrl } from "./common.mjs";

export async function runRedditUser(flags) {
  const username = String(flags.username || "").trim();
  const port = getRedditPort(flags.port);
  if (!username) {
    throw new Error("Missing required --username");
  }
  const { client } = await connectRedditPage(port);
  try {
    await navigate(client, getRedditUrl(), 2500);
    const result = await evaluate(client, `
      (async () => {
        try {
          const resp = await fetch('/user/' + encodeURIComponent(${JSON.stringify(username)}) + '/about.json?raw_json=1', { credentials: 'include' });
          const text = await resp.text();
          if (!resp.ok) return { ok: false, status: resp.status, body: text.slice(0, 300) };
          const data = JSON.parse(text)?.data || {};
          return {
            ok: true,
            item: {
              username: data.name || '',
              createdUtc: data.created_utc ?? null,
              postKarma: data.link_karma ?? null,
              commentKarma: data.comment_karma ?? null,
              isGold: Boolean(data.is_gold),
              isMod: Boolean(data.is_mod),
              verified: Boolean(data.verified),
              icon: data.icon_img || ''
            }
          };
        } catch (error) {
          return { ok: false, status: null, body: String(error) };
        }
      })()
    `);
    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({ ok: false, username, status: result?.status ?? null, message: "Reddit user request failed.", body: result?.body || "" }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`${JSON.stringify({ ok: true, item: result.item || {} }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
