import { buildYoutubeUrlSet } from "./utils-helpers.mjs";

function buildSampleResult() {
  const sample = buildYoutubeUrlSet("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  return {
    ok: sample.videoId === "dQw4w9WgXcQ",
    command: "youtube transcript-group",
    sample,
  };
}

export async function runYoutubeTranscriptGroupTest() {
  process.stdout.write(`${JSON.stringify(buildSampleResult(), null, 2)}\n`);
}
