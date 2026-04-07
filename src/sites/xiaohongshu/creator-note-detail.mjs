import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectXiaohongshuPage, getXiaohongshuPort } from "./common.mjs";

export async function runXiaohongshuCreatorNoteDetail(flags) {
  const noteId = String(flags.note_id || "").trim();
  const port = getXiaohongshuPort(flags.port);
  if (!noteId) throw new Error("Missing required --note_id");
  const { client } = await connectXiaohongshuPage(port);
  try {
    await navigate(client, "https://creator.xiaohongshu.com/new/home", 3000);
    const data = await evaluate(client, `
      (async () => {
        try {
          const resp = await fetch('/api/galaxy/creator/data/note_detail?note_id=' + encodeURIComponent(${JSON.stringify(noteId)}), { credentials: 'include' });
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
      process.stdout.write(`${JSON.stringify({ ok: false, noteId, message: "Xiaohongshu creator-note-detail request failed.", body: data?.body || "" }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }
    const d = data.data || {};
    process.stdout.write(`${JSON.stringify({
      ok: true,
      noteId,
      items: [
        { channel: "Total", reads: d.total_read ?? 0, engagement: d.total_engage ?? 0, likes: d.total_like ?? 0, collects: d.total_fav ?? 0, comments: d.total_cmt ?? 0, shares: d.total_share ?? 0 },
        { channel: "Organic", reads: d.normal_read ?? 0, engagement: d.normal_engage ?? 0, likes: d.normal_like ?? 0, collects: d.normal_fav ?? 0, comments: d.normal_cmt ?? 0, shares: d.normal_share ?? 0 },
        { channel: "Promoted", reads: d.total_promo_read ?? 0, engagement: 0, likes: 0, collects: 0, comments: 0, shares: 0 },
        { channel: "Video", reads: d.video_read ?? 0, engagement: d.video_engage ?? 0, likes: d.video_like ?? 0, collects: d.video_fav ?? 0, comments: d.video_cmt ?? 0, shares: d.video_share ?? 0 },
      ],
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
