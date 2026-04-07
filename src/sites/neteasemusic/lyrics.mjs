import { getNeteaseLyricsUrl, runNeteaseRead } from "./adapters.mjs";

export async function runNeteaseMusicLyrics(flags) {
  return runNeteaseRead(flags, getNeteaseLyricsUrl(flags));
}
