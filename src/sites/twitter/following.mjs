import { getTwitterFollowingUrl, runTwitterHistoryForUrl } from "./adapters.mjs";

export async function runTwitterFollowing(flags) {
  return runTwitterHistoryForUrl(flags, getTwitterFollowingUrl(flags));
}
