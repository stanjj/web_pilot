import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectXiaoyuzhouPage, getXiaoyuzhouPort, getXiaoyuzhouUrl } from "./common.mjs";

function formatDate(iso) {
  return iso ? String(iso).slice(0, 10) : "-";
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export async function runXiaoyuzhouPodcastEpisodes(flags) {
  const id = String(flags.id || "").trim();
  const limit = Math.min(Number(flags.limit ?? 15), 15);
  const port = getXiaoyuzhouPort(flags.port);

  if (!id) {
    throw new Error("Missing required --id");
  }

  const { client } = await connectXiaoyuzhouPage(port);

  try {
    await navigate(client, getXiaoyuzhouUrl(`/podcast/${id}`), 3500);

    const result = await evaluate(client, `
      (() => {
        const script = document.querySelector('#__NEXT_DATA__')?.textContent || '';
        if (!script) {
          return { ok: false, status: null, body: 'Failed to extract __NEXT_DATA__' };
        }

        let parsed;
        try {
          parsed = JSON.parse(script);
        } catch (error) {
          return { ok: false, status: null, body: 'Malformed __NEXT_DATA__ JSON' };
        }

        const pageProps = parsed?.props?.pageProps;
        const podcast = pageProps?.podcast;
        if (!podcast) {
          return { ok: false, status: 404, body: 'Podcast not found' };
        }

        const episodes = (podcast.episodes || []).map((ep, index) => ({
          rank: index + 1,
          eid: ep.eid || '',
          title: ep.title || '',
          duration: ep.duration ?? null,
          plays: ep.playCount ?? null,
          date: ep.pubDate || '',
          url: ep.eid ? ('https://www.xiaoyuzhoufm.com/episode/' + ep.eid) : ''
        }));

        return {
          ok: true,
          podcast: {
            title: podcast.title || '',
            author: podcast.author || '',
            url: 'https://www.xiaoyuzhoufm.com/podcast/' + (podcast.pid || ${JSON.stringify(id)})
          },
          items: episodes
        };
      })()
    `);

    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        id,
        status: result?.status ?? null,
        message: "Xiaoyuzhou podcast-episodes request failed.",
        body: result?.body || "",
      }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      id,
      podcast: result.podcast || null,
      count: Math.min((result.items || []).length, limit),
      items: (result.items || []).slice(0, limit).map((item) => ({
        ...item,
        duration: formatDuration(item.duration),
        date: formatDate(item.date),
      })),
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
