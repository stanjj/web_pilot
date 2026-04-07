import { getTwitterNotificationsUrl, runTwitterHistoryForUrl } from "./adapters.mjs";

export async function runTwitterNotifications(flags) {
  return runTwitterHistoryForUrl(flags, getTwitterNotificationsUrl(flags));
}
