function parseUrlParts(input) {
  const raw = String(input || "").trim();
  try {
    const url = new URL(raw);
    const parts = url.pathname.split("/").filter(Boolean);
    const showIndex = parts.indexOf("podcast");
    const showSlug = showIndex !== -1 ? parts[showIndex + 1] || "" : "";
    const episodeSlug = showIndex !== -1 ? parts[showIndex + 2] || "" : "";
    const showId = parts.find((part) => /^id\d+$/i.test(part)) || "";
    const episodeId = parts.find((part) => /^i\d+$/i.test(part)) || "";
    return {
      input: raw,
      country: parts[0] || "",
      showSlug,
      episodeSlug,
      showId: showId.replace(/^id/i, ""),
      episodeId: episodeId.replace(/^i/i, ""),
    };
  } catch {
    return {
      input: raw,
      country: "",
      showSlug: "",
      episodeSlug: "",
      showId: "",
      episodeId: "",
    };
  }
}

export async function runApplePodcastsUtils(flags) {
  const url = String(flags.url || flags.input || "").trim();
  if (!url) {
    throw new Error("Missing required --url");
  }

  const parsed = parseUrlParts(url);
  process.stdout.write(`${JSON.stringify({
    ok: Boolean(parsed.showId || parsed.episodeId),
    ...parsed,
    message: (parsed.showId || parsed.episodeId) ? "" : "Could not parse Apple Podcasts identifiers from input URL.",
  }, null, 2)}\n`);
}
