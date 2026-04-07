import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectXiaohongshuPage, getXiaohongshuPort } from "./common.mjs";

export async function runXiaohongshuCreatorProfile(flags) {
  const port = getXiaohongshuPort(flags.port);
  const { client } = await connectXiaohongshuPage(port);
  try {
    await navigate(client, "https://creator.xiaohongshu.com/new/home", 3500);
    const data = await evaluate(client, `
      (async () => {
        try {
          const resp = await fetch('/api/galaxy/creator/home/personal_info', { credentials: 'include' });
          const text = await resp.text();
          if (!resp.ok) return { ok: false, status: resp.status, body: text.slice(0, 300) };
          const json = JSON.parse(text);
          return { ok: true, data: json?.data || {} };
        } catch (error) {
          return { ok: false, body: String(error) };
        }
      })()
    `);
    if (!data?.ok) {
      process.stdout.write(`${JSON.stringify({ ok: false, message: "Xiaohongshu creator-profile request failed.", body: data?.body || "" }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }
    const d = data.data || {};
    const grow = d.grow_info || {};
    process.stdout.write(`${JSON.stringify({
      ok: true,
      item: {
        name: d.name || "",
        followers: d.fans_count ?? 0,
        following: d.follow_count ?? 0,
        likesAndCollects: d.faved_count ?? 0,
        creatorLevel: grow.level ?? 0,
        levelProgress: `${grow.fans_count ?? 0}/${grow.max_fans_count ?? 0} fans`,
        bio: String(d.personal_desc || "").replace(/\n/g, " | "),
      },
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
