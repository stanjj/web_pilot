import { runNeteaseRead } from "./adapters.mjs";
import { getNeteaseMusicUrl } from "./common.mjs";

export async function runNeteaseMusicPlaying(flags) {
  return runNeteaseRead(flags, getNeteaseMusicUrl());
}
