import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectYoutubePage, getYoutubePort, getYoutubeUrl } from "./common.mjs";

export async function runYoutubeSearch(flags) {
  const query = String(flags.query || "").trim();
  const limit = Math.min(Number(flags.limit ?? 20), 50);
  const port = getYoutubePort(flags.port);

  if (!query) {
    throw new Error("Missing required --query");
  }

  const { client } = await connectYoutubePage(port);

  try {
    await navigate(client, getYoutubeUrl(), 3000);

    const result = await evaluate(client, `
      (async () => {
        const query = ${JSON.stringify(query)};
        const limit = ${Number.isFinite(limit) ? Math.max(1, limit) : 20};
        const cfg = window.ytcfg?.data_ || {};
        const apiKey = cfg.INNERTUBE_API_KEY;
        const context = cfg.INNERTUBE_CONTEXT;
        if (!apiKey || !context) {
          return { ok: false, status: null, body: 'YouTube config not found' };
        }

        try {
          const resp = await fetch('/youtubei/v1/search?key=' + apiKey + '&prettyPrint=false', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ context, query })
          });
          const text = await resp.text();
          if (!resp.ok) {
            return { ok: false, status: resp.status, body: text.slice(0, 300) };
          }

          let data;
          try {
            data = JSON.parse(text);
          } catch (error) {
            return { ok: false, status: resp.status, body: text.slice(0, 300), error: String(error) };
          }

          const sections = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
          const videos = [];

          for (const section of sections) {
            for (const item of (section?.itemSectionRenderer?.contents || [])) {
              if (item?.videoRenderer && videos.length < limit) {
                const video = item.videoRenderer;
                videos.push({
                  rank: videos.length + 1,
                  title: video?.title?.runs?.[0]?.text || '',
                  channel: video?.ownerText?.runs?.[0]?.text || '',
                  views: video?.viewCountText?.simpleText || video?.shortViewCountText?.simpleText || '',
                  duration: video?.lengthText?.simpleText || 'LIVE',
                  url: video?.videoId ? ('https://www.youtube.com/watch?v=' + video.videoId) : ''
                });
              }
            }
          }

          return { ok: true, count: videos.length, items: videos };
        } catch (error) {
          return { ok: false, status: null, body: String(error) };
        }
      })()
    `);

    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        query,
        status: result?.status ?? null,
        message: "YouTube search request failed.",
        body: result?.body || "",
      }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      query,
      count: result.count,
      items: result.items || [],
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
