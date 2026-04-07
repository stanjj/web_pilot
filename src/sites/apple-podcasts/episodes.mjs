import { formatDuration, getApplePodcastsLookupUrl } from "./common.mjs";

export async function runApplePodcastsEpisodes(flags) {
  const id = String(flags.id ?? "").trim();
  if (!id) {
    throw new Error("Missing required flag: --id");
  }

  const limit = Math.min(Number(flags.limit ?? 15), 25);
  const resp = await fetch(getApplePodcastsLookupUrl(id, limit));
  if (!resp.ok) {
    throw new Error(`Apple Podcasts episodes failed: HTTP ${resp.status}`);
  }

  const data = await resp.json();
  const results = data?.results || [];
  const show = results.find((item) => item?.wrapperType === "collection") || null;
  const episodes = results
    .filter((item) => item?.wrapperType === "podcastEpisode")
    .slice(0, limit)
    .map((item, index) => ({
      rank: index + 1,
      title: item?.trackName || "",
      duration: formatDuration(item?.trackTimeMillis),
      date: item?.releaseDate || null,
      description: String(item?.description || "").replace(/\s+/g, " ").trim().slice(0, 160),
      url: item?.episodeUrl || item?.trackViewUrl || "",
    }));

  process.stdout.write(`${JSON.stringify({
    ok: true,
    id,
    show: show ? {
      title: show?.collectionName || "",
      author: show?.artistName || "",
      episodes: show?.trackCount ?? null,
      url: show?.collectionViewUrl || "",
    } : null,
    count: episodes.length,
    items: episodes,
  }, null, 2)}\n`);
}
