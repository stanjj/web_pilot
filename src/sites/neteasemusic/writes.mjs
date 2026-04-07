import { runNeteaseGated } from "./adapters.mjs";

export async function runNeteaseMusicLike(flags) {
  return runNeteaseGated(flags, "like", "Netease Music like");
}

export async function runNeteaseMusicNext(flags) {
  return runNeteaseGated(flags, "next", "Netease Music next track");
}

export async function runNeteaseMusicPlay(flags) {
  return runNeteaseGated(flags, "play", "Netease Music play");
}

export async function runNeteaseMusicPrev(flags) {
  return runNeteaseGated(flags, "prev", "Netease Music previous track");
}

export async function runNeteaseMusicVolume(flags) {
  return runNeteaseGated(flags, "volume", "Netease Music volume");
}
