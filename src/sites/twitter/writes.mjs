import { runTwitterGatedWrite } from "./adapters.mjs";

export async function runTwitterAccept(flags) {
  return runTwitterGatedWrite(flags, "accept", "Twitter DM request accept");
}

export async function runTwitterBookmark(flags) {
  return runTwitterGatedWrite(flags, "bookmark", "Twitter bookmark");
}

export async function runTwitterDelete(flags) {
  return runTwitterGatedWrite(flags, "delete", "Twitter post delete");
}

export async function runTwitterDownload(flags) {
  return runTwitterGatedWrite(flags, "download", "Twitter media download");
}

export async function runTwitterFollow(flags) {
  return runTwitterGatedWrite(flags, "follow", "Twitter follow");
}

export async function runTwitterLike(flags) {
  return runTwitterGatedWrite(flags, "like", "Twitter like");
}

export async function runTwitterPost(flags) {
  return runTwitterGatedWrite(flags, "post", "Twitter post");
}

export async function runTwitterReply(flags) {
  return runTwitterGatedWrite(flags, "reply", "Twitter reply");
}

export async function runTwitterReplyDm(flags) {
  return runTwitterGatedWrite(flags, "reply-dm", "Twitter DM reply");
}

export async function runTwitterUnbookmark(flags) {
  return runTwitterGatedWrite(flags, "unbookmark", "Twitter unbookmark");
}

export async function runTwitterUnfollow(flags) {
  return runTwitterGatedWrite(flags, "unfollow", "Twitter unfollow");
}
