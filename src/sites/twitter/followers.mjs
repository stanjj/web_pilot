import { getTwitterFollowersUrl, runTwitterHistoryForUrl } from "./adapters.mjs";

export async function runTwitterFollowers(flags) {
  return runTwitterHistoryForUrl(flags, getTwitterFollowersUrl(flags));
}
