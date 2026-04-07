import { getApplePodcastsSearchUrl } from "./common.mjs";

export async function runApplePodcastsSearch(flags) {
  const keyword = String(flags.keyword ?? "").trim();
  if (!keyword) {
    throw new Error("Missing required flag: --keyword");
  }

  const limit = Math.min(Number(flags.limit ?? 10), 25);
  const resp = await fetch(getApplePodcastsSearchUrl(keyword, limit));
  if (!resp.ok) {
    throw new Error(`Apple Podcasts search failed: HTTP ${resp.status}`);
  }

  const data = await resp.json();
  const items = (data?.results || []).map((item, index) => ({
    rank: index + 1,
    id: item?.collectionId ?? null,
    title: item?.collectionName || "",
    author: item?.artistName || "",
    episodes: item?.trackCount ?? null,
    genre: Array.isArray(item?.genres) ? item.genres.join(", ") : "",
    url: item?.collectionViewUrl || "",
  }));

  process.stdout.write(`${JSON.stringify({
    ok: true,
    keyword,
    count: items.length,
    items,
  }, null, 2)}\n`);
}
