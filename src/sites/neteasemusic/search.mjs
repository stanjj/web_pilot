import { getNeteaseSearchUrl, runNeteaseSearch } from "./adapters.mjs";

export async function runNeteaseMusicSearch(flags) {
  return runNeteaseSearch(flags, getNeteaseSearchUrl(flags));
}
