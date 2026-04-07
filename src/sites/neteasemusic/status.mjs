import { runNeteaseRead } from "./adapters.mjs";
import { getNeteaseMusicUrl } from "./common.mjs";

export async function runNeteaseMusicStatus(flags) {
  return runNeteaseRead(flags, getNeteaseMusicUrl());
}
