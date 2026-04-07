import { getApplePodcastsCountry, getApplePodcastsTopUrl } from "./common.mjs";

export async function runApplePodcastsTop(flags) {
  const country = getApplePodcastsCountry(flags.country);
  const limit = Math.min(Number(flags.limit ?? 20), 100);
  const resp = await fetch(getApplePodcastsTopUrl(country));
  if (!resp.ok) {
    throw new Error(`Apple Podcasts top failed: HTTP ${resp.status}`);
  }

  const data = await resp.json();
  const items = (data?.feed?.results || []).slice(0, limit).map((item, index) => ({
    rank: index + 1,
    id: item?.id || "",
    title: item?.name || "",
    author: item?.artistName || "",
    genre: Array.isArray(item?.genres) ? item.genres.map((genre) => genre?.name).filter(Boolean).join(", ") : "",
    url: item?.url || "",
  }));

  process.stdout.write(`${JSON.stringify({
    ok: true,
    country,
    count: items.length,
    items,
  }, null, 2)}\n`);
}
