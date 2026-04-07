import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectBilibiliPage, getBilibiliPort } from "./common.mjs";

export async function runBilibiliSubtitle(flags) {
  const bvid = String(flags.bvid || "").trim();
  const lang = String(flags.lang || "").trim();
  const port = getBilibiliPort(flags.port);

  if (!bvid) {
    throw new Error("Missing required --bvid");
  }

  const { client } = await connectBilibiliPage(port);

  try {
    await navigate(client, `https://www.bilibili.com/video/${bvid}/`, 3500);
    const result = await evaluate(client, `
      (async () => {
        try {
          const cid = window.__INITIAL_STATE__?.videoData?.cid;
          if (!cid) {
            return { ok: false, body: 'Could not extract CID from video page' };
          }

          const resp = await fetch('https://api.bilibili.com/x/player/v2?bvid=' + ${JSON.stringify(bvid)} + '&cid=' + cid, { credentials: 'include' });
          const text = await resp.text();
          const data = JSON.parse(text);
          const subtitles = data?.data?.subtitle?.subtitles || [];
          if (!subtitles.length) {
            return { ok: false, body: 'No subtitles found for this video' };
          }

          const target = ${JSON.stringify(lang)}
            ? (subtitles.find((s) => s.lan === ${JSON.stringify(lang)}) || subtitles[0])
            : subtitles[0];
          const subUrl = target?.subtitle_url || '';
          if (!subUrl) {
            return { ok: false, body: 'Subtitle URL missing from player response' };
          }
          const finalUrl = subUrl.startsWith('//') ? ('https:' + subUrl) : subUrl;
          const subResp = await fetch(finalUrl, { credentials: 'include' });
          const subText = await subResp.text();
          const subJson = JSON.parse(subText);
          const body = Array.isArray(subJson?.body) ? subJson.body : [];
          return {
            ok: true,
            language: target?.lan || '',
            items: body.map((item, idx) => ({
              index: idx + 1,
              from: Number(item.from || 0).toFixed(2) + 's',
              to: Number(item.to || 0).toFixed(2) + 's',
              content: item.content || '',
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
        bvid,
        message: "Bilibili subtitle request failed.",
        body: result?.body || "",
      }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      bvid,
      language: result.language,
      count: result.items?.length || 0,
      items: result.items || [],
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
