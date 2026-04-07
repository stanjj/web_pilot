import { getTwitterProfileUrl, runTwitterReadForUrl } from "./adapters.mjs";

export async function runTwitterProfile(flags) {
  return runTwitterReadForUrl(flags, getTwitterProfileUrl(flags));
}
