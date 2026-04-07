import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectXiaohongshuPage, getXiaohongshuPort } from "./common.mjs";

export async function runXiaohongshuCreatorStats(flags) {
  const period = String(flags.period || "seven").trim();
  const port = getXiaohongshuPort(flags.port);
  const { client } = await connectXiaohongshuPage(port);
  try {
    await navigate(client, "https://creator.xiaohongshu.com/new/home", 3500);
    const data = await evaluate(client, `
      (async () => {
        try {
          const resp = await fetch('/api/galaxy/creator/data/note_detail_new', { credentials: 'include' });
          const text = await resp.text();
          if (!resp.ok) return { ok: false, status: resp.status, body: text.slice(0, 300) };
          const json = JSON.parse(text);
          return { ok: true, data: json?.data || {} };
        } catch (error) {
          return { ok: false, body: String(error) };
        }
      })()
    `);
    const stats = data?.data?.[period];
    if (!data?.ok || !stats) {
      process.stdout.write(`${JSON.stringify({ ok: false, period, message: "Xiaohongshu creator-stats request failed.", body: data?.body || "" }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`${JSON.stringify({
      ok: true,
      period,
      item: {
        views: stats.view_count ?? 0,
        avgViewTimeMs: stats.view_time_avg ?? 0,
        homeViews: stats.home_view_count ?? 0,
        likes: stats.like_count ?? 0,
        collects: stats.collect_count ?? 0,
        comments: stats.comment_count ?? 0,
        shares: stats.share_count ?? 0,
        riseFans: stats.rise_fans_count ?? 0,
      },
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
