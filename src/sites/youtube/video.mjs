import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectYoutubePage, getYoutubePort, parseYoutubeVideoId } from "./common.mjs";

export async function runYoutubeVideo(flags) {
  const urlOrId = String(flags.url || "").trim();
  const videoId = parseYoutubeVideoId(urlOrId);
  const port = getYoutubePort(flags.port);

  if (!videoId) {
    throw new Error("Missing required --url (YouTube URL or video ID)");
  }

  const { client } = await connectYoutubePage(port);

  try {
    await navigate(client, `https://www.youtube.com/watch?v=${videoId}`, 4500);

    const result = await evaluate(client, `
      (() => {
        const player = window.ytInitialPlayerResponse;
        const yt = window.ytInitialData;
        if (!player) {
          return { ok: false, body: 'ytInitialPlayerResponse not found' };
        }

        const details = player.videoDetails || {};
        const microformat = player.microformat?.playerMicroformatRenderer || {};

        let fullDescription = details.shortDescription || '';
        try {
          const contents = yt?.contents?.twoColumnWatchNextResults?.results?.results?.contents || [];
          for (const c of contents) {
            const desc = c?.videoSecondaryInfoRenderer?.attributedDescription?.content;
            if (desc) {
              fullDescription = desc;
              break;
            }
          }
        } catch {}

        let likes = '';
        let subscribers = '';
        try {
          const contents = yt?.contents?.twoColumnWatchNextResults?.results?.results?.contents || [];
          for (const c of contents) {
            const buttons = c?.videoPrimaryInfoRenderer?.videoActions?.menuRenderer?.topLevelButtons || [];
            for (const b of buttons) {
              const toggle = b?.segmentedLikeDislikeButtonViewModel
                ?.likeButtonViewModel?.likeButtonViewModel?.toggleButtonViewModel
                ?.toggleButtonViewModel?.defaultButtonViewModel?.buttonViewModel;
              if (toggle?.title) {
                likes = toggle.title;
                break;
              }
            }
            const owner = c?.videoSecondaryInfoRenderer?.owner?.videoOwnerRenderer?.subscriberCountText?.simpleText;
            if (owner) subscribers = owner;
          }
        } catch {}

        return {
          ok: true,
          item: {
            title: details.title || '',
            channel: details.author || '',
            channelId: details.channelId || '',
            videoId: details.videoId || '',
            views: details.viewCount || '',
            likes,
            subscribers,
            duration: details.lengthSeconds ? (details.lengthSeconds + 's') : '',
            publishDate: microformat.publishDate || microformat.uploadDate || details.publishDate || '',
            category: microformat.category || '',
            description: fullDescription,
            keywords: (details.keywords || []).join(', '),
            isLive: details.isLiveContent || false,
            thumbnail: details.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || '',
          }
        };
      })()
    `);

    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        videoId,
        message: "YouTube video request failed.",
        body: result?.body || "",
      }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      videoId,
      item: result.item || {},
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
