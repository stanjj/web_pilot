import { getNeteasePlaylistUrl, runNeteaseHistory } from "./adapters.mjs";

export async function runNeteaseMusicPlaylist(flags) {
  return runNeteaseHistory(flags, getNeteasePlaylistUrl(flags));
}
