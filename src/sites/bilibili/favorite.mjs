import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectBilibiliPage, getBilibiliPort, getBilibiliUrl } from "./common.mjs";

export async function runBilibiliFavorite(flags) {
  const page = Math.max(1, Number(flags.page ?? 1));
  const limit = Math.min(Number(flags.limit ?? 20), 40);
  const port = getBilibiliPort(flags.port);
  const { client } = await connectBilibiliPage(port);

  try {
    await navigate(client, getBilibiliUrl(), 2500);
    const result = await evaluate(client, `
      (async () => {
        try {
          const foldersResp = await fetch('https://api.bilibili.com/x/v3/fav/folder/created/list-all?up_mid=0', { credentials: 'include' });
          const foldersText = await foldersResp.text();
          const foldersData = JSON.parse(foldersText);
          if (foldersData?.code === -101) {
            return { ok: false, needsLogin: true, body: foldersText.slice(0, 300) };
          }
          const folders = foldersData?.data?.list || [];
          if (!folders.length) {
            return { ok: true, mediaId: null, items: [] };
          }

          const mediaId = folders[0].id;
          const resp = await fetch('https://api.bilibili.com/x/v3/fav/resource/list?media_id=' + mediaId + '&pn=' + ${page} + '&ps=' + ${limit}, { credentials: 'include' });
          const text = await resp.text();
          const data = JSON.parse(text);
          if (data?.code !== 0) {
            return { ok: false, body: text.slice(0, 300) };
          }
          const items = (data?.data?.medias || []).map((item, index) => ({
            rank: index + 1,
            title: item?.title || '',
            author: item?.upper?.name || '',
            plays: item?.cnt_info?.play ?? 0,
            url: item?.bvid ? ('https://www.bilibili.com/video/' + item.bvid) : '',
          }));
          return { ok: true, mediaId, items };
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
          ? "Bilibili favorite requires a logged-in session in the shared agent browser."
          : "Bilibili favorite request failed.",
        body: result?.body || "",
      }, null, 2)}\n`);
      process.exitCode = result?.needsLogin ? 2 : 1;
      return;
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      mediaId: result.mediaId,
      count: result.items?.length || 0,
      items: result.items || [],
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
