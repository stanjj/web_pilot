function parseVideoId(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.split("/").filter(Boolean)[0] || "";
    }
    return url.searchParams.get("v") || "";
  } catch {
    return "";
  }
}

export function buildYoutubeUrlSet(input) {
  const raw = String(input || "").trim();
  const videoId = parseVideoId(raw);
  return {
    input: raw,
    videoId,
    watchUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : "",
    shortUrl: videoId ? `https://youtu.be/${videoId}` : "",
    embedUrl: videoId ? `https://www.youtube.com/embed/${videoId}` : "",
  };
}