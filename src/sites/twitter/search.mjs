import { getTwitterSearchUrl, runTwitterSearchForUrl } from "./adapters.mjs";

export async function runTwitterSearch(flags) {
  return runTwitterSearchForUrl(flags, getTwitterSearchUrl(flags));
}
