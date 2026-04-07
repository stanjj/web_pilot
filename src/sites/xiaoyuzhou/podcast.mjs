import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectXiaoyuzhouPage, getXiaoyuzhouPort, getXiaoyuzhouUrl } from "./common.mjs";

function formatDate(iso) {
  return iso ? String(iso).slice(0, 10) : "-";
}

export async function runXiaoyuzhouPodcast(flags) {
  const id = String(flags.id || "").trim();
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

        return {
          ok: true,
          item: {
            title: podcast.title || '',
            author: podcast.author || '',
            description: podcast.brief || '',
            subscribers: podcast.subscriptionCount ?? null,
            episodes: podcast.episodeCount ?? null,
            updated: podcast.latestEpisodePubDate || '',
            url: 'https://www.xiaoyuzhoufm.com/podcast/' + (podcast.pid || ${JSON.stringify(id)})
          }
        };
      })()
    `);

    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        id,
        status: result?.status ?? null,
        message: "Xiaoyuzhou podcast request failed.",
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
        updated: formatDate(result.item?.updated),
      },
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
