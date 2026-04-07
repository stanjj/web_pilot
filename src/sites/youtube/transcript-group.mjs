import { runYoutubeTranscript } from "./transcript.mjs";

export async function runYoutubeTranscriptGroup(flags) {
  await runYoutubeTranscript({ ...flags, mode: "grouped" });
}
