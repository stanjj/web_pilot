import { getTwitterTimelineUrl, runTwitterReadForUrl } from "./adapters.mjs";

export async function runTwitterTimeline(flags) {
  return runTwitterReadForUrl(flags, getTwitterTimelineUrl(flags));
}
