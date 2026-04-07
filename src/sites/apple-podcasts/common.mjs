export function getApplePodcastsCountry(input) {
  return String(input || "us").trim().toLowerCase() || "us";
}

export function getApplePodcastsSearchUrl(keyword, limit = 10) {
  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("media", "podcast");
  url.searchParams.set("term", keyword);
  url.searchParams.set("limit", String(limit));
  return url.toString();
}

export function getApplePodcastsLookupUrl(id, limit = 15) {
  const url = new URL("https://itunes.apple.com/lookup");
  url.searchParams.set("id", String(id));
  url.searchParams.set("entity", "podcastEpisode");
  url.searchParams.set("limit", String(limit));
  return url.toString();
}

export function getApplePodcastsTopUrl(country = "us") {
  return `https://rss.applemarketingtools.com/api/v2/${encodeURIComponent(country)}/podcasts/top/100/podcasts.json`;
}

export function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(Number(milliseconds || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
