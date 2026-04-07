import { buildYoutubeUrlSet } from "./utils.mjs";

export async function runYoutubeTranscriptGroupTest() {
  const sample = buildYoutubeUrlSet("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  process.stdout.write(`${JSON.stringify({
    ok: sample.videoId === "dQw4w9WgXcQ",
    command: "youtube transcript-group",
    sample,
  }, null, 2)}\n`);
}
