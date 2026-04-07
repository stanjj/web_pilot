import { getTwitterBookmarksUrl, runTwitterHistoryForUrl } from "./adapters.mjs";

export async function runTwitterBookmarks(flags) {
  return runTwitterHistoryForUrl(flags, getTwitterBookmarksUrl(flags));
}
