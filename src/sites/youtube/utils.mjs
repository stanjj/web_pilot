import { buildYoutubeUrlSet } from "./utils-helpers.mjs";

export { buildYoutubeUrlSet } from "./utils-helpers.mjs";

export async function runYoutubeUtils(flags) {
  const url = String(flags.url || flags.input || "").trim();
  if (!url) {
    throw new Error("Missing required --url");
  }

  const result = buildYoutubeUrlSet(url);
  process.stdout.write(`${JSON.stringify({
    ok: Boolean(result.videoId),
    ...result,
    message: result.videoId ? "" : "Could not parse a YouTube video ID from input.",
  }, null, 2)}\n`);
}
