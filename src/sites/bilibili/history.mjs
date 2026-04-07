import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectBilibiliPage, getBilibiliPort, getBilibiliUrl } from "./common.mjs";

function formatDuration(seconds) {
  const total = Math.max(0, Number(seconds || 0));
  const mins = Math.floor(total / 60);
  const secs = Math.floor(total % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export async function runBilibiliHistory(flags) {
  const limit = Math.min(Number(flags.limit ?? 20), 30);
  const port = getBilibiliPort(flags.port);
  const { client } = await connectBilibiliPage(port);

  try {
    await navigate(client, getBilibiliUrl(), 2500);

    const result = await evaluate(client, `
      (async () => {
        const limit = ${Number.isFinite(limit) ? Math.max(1, limit) : 20};
        const url = 'https://api.bilibili.com/x/web-interface/history/cursor?ps=' + limit + '&type=archive';

        try {
          const resp = await fetch(url, { credentials: 'include' });
          const text = await resp.text();
          const data = JSON.parse(text);
          if (resp.status === 412 || data?.code === -101) {
            return { ok: false, needsLogin: true, status: resp.status, body: text.slice(0, 300) };
          }
          const items = data?.data?.list || [];
          return { ok: true, items };
        } catch (error) {
          return { ok: false, body: String(error) };
        }
      })()
    `);

    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        status: result?.status ?? null,
        needsLogin: Boolean(result?.needsLogin),
        message: result?.needsLogin
          ? "Bilibili history requires a logged-in session in the shared agent browser."
          : "Bilibili history request failed.",
        body: result?.body || "",
      }, null, 2)}\n`);
      process.exitCode = result?.needsLogin ? 2 : 1;
      return;
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      count: Math.min((result.items || []).length, limit),
      items: (result.items || []).slice(0, limit).map((item, index) => {
        const progress = Number(item?.progress ?? 0);
        const duration = Number(item?.duration ?? 0);
        const progressText = progress < 0 || progress >= duration
          ? "已看完"
          : `${formatDuration(progress)}/${formatDuration(duration)} (${duration > 0 ? Math.round(progress / duration * 100) : 0}%)`;
        return {
          rank: index + 1,
          title: item?.title || "",
          author: item?.author_name || "",
          progress: progressText,
          url: item?.history?.bvid ? `https://www.bilibili.com/video/${item.history.bvid}` : "",
        };
      }),
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
