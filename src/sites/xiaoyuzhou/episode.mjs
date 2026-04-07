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

export async function runXiaoyuzhouEpisode(flags) {
  const id = String(flags.id || "").trim();
  const port = getXiaoyuzhouPort(flags.port);

  if (!id) {
    throw new Error("Missing required --id");
  }

  const { client } = await connectXiaoyuzhouPage(port);

  try {
    await navigate(client, getXiaoyuzhouUrl(`/episode/${id}`), 3500);

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
        const ep = pageProps?.episode;
        if (!ep) {
          return { ok: false, status: 404, body: 'Episode not found' };
        }

        return {
          ok: true,
          item: {
            eid: ep.eid || ${JSON.stringify(id)},
            title: ep.title || '',
            podcast: ep.podcast?.title || '',
            duration: ep.duration ?? null,
            plays: ep.playCount ?? null,
            comments: ep.commentCount ?? null,
            likes: ep.clapCount ?? null,
            date: ep.pubDate || '',
            shownotes: ep.description || ep.brief || '',
            url: 'https://www.xiaoyuzhoufm.com/episode/' + (ep.eid || ${JSON.stringify(id)})
          }
        };
      })()
    `);

    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        id,
        status: result?.status ?? null,
        message: "Xiaoyuzhou episode request failed.",
        body: result?.body || "",
      }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      id,
      item: {
        ...result.item,
        duration: formatDuration(result.item?.duration),
        date: formatDate(result.item?.date),
        shownotes: String(result.item?.shownotes || "").replace(/\s+/g, " ").trim().slice(0, 200),
      },
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
