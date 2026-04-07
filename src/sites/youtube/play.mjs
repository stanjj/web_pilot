import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectYoutubePage, getYoutubePort, getYoutubeWatchUrl } from "./common.mjs";

export async function runYoutubePlay(flags) {
  const urlOrId = String(flags.url || flags.id || "").trim();
  const autoplay = flags.autoplay !== false;
  const port = getYoutubePort(flags.port);
  const targetId = String(flags["target-id"] || "").trim();
  const reuseTab = Boolean(flags["reuse-tab"]) || Boolean(targetId);

  if (!urlOrId) {
    throw new Error("Missing required --url (YouTube URL or video ID)");
  }

  const watchUrl = getYoutubeWatchUrl(urlOrId, autoplay);
  if (!watchUrl) {
    throw new Error("Invalid --url (YouTube URL or video ID)");
  }

  const { client, target } = await connectYoutubePage(port, {
    targetId,
    preferExisting: reuseTab,
  });

  try {
    await navigate(client, watchUrl, 4500);
    const item = await evaluate(client, `
      (async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const video = document.querySelector('video');
        if (!video) {
          return { ok: false, message: 'No video element found', title: document.title, url: location.href };
        }

        try {
          await video.play();
        } catch {}

        if (video.paused) {
          const button = document.querySelector('.ytp-play-button');
          if (button) button.click();
          await wait(1200);
        }

        return {
          ok: true,
          title: document.title,
          url: location.href,
          paused: Boolean(video.paused),
          currentTime: Number(video.currentTime || 0),
          duration: Number(video.duration || 0),
          targetId: ${JSON.stringify(target.id || "")}
        };
      })()
    `);

    process.stdout.write(`${JSON.stringify({
      ok: Boolean(item?.ok),
      targetId: target.id || "",
      reusedTab: reuseTab,
      item,
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
