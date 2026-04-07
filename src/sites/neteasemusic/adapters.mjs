import { runUiGatedWrite, runUiHistory, runUiRead, runUiSearch } from "../../core/ui-site.mjs";
import { connectNeteaseMusicPage, getNeteaseMusicPort } from "./common.mjs";

function buildAdapter(flags, url) {
  return {
    site: "neteasemusic",
    getPort: (input) => getNeteaseMusicPort(input ?? flags.port),
    getUrl: () => url,
    connectPage: (port) => connectNeteaseMusicPage(port),
  };
}

export function getNeteaseSearchUrl(flags) {
  const keyword = String(flags.keyword || flags.query || "").trim();
  return keyword
    ? `https://music.163.com/#/search/m/?s=${encodeURIComponent(keyword)}&type=1`
    : "https://music.163.com/#/discover";
}

export function getNeteasePlaylistUrl(flags) {
  const id = String(flags.id || flags.playlist || "").trim();
  return id
    ? `https://music.163.com/#/playlist?id=${encodeURIComponent(id)}`
    : "https://music.163.com/#/my/m/music/playlist";
}

export function getNeteaseLyricsUrl(flags) {
  const id = String(flags.id || flags.song || "").trim();
  return id
    ? `https://music.163.com/#/song?id=${encodeURIComponent(id)}`
    : "https://music.163.com/";
}

export async function runNeteaseRead(flags, url) {
  return runUiRead(flags, buildAdapter(flags, url));
}

export async function runNeteaseHistory(flags, url) {
  return runUiHistory(flags, buildAdapter(flags, url));
}

export async function runNeteaseSearch(flags, url) {
  return runUiSearch(flags, buildAdapter(flags, url));
}

export async function runNeteaseGated(flags, action, label) {
  return runUiGatedWrite(flags, { action, label });
}
