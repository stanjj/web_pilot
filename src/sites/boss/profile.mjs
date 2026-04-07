import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export function getBossProfilePath() {
  return resolve(process.cwd(), "config", "boss_profile.zh-CN.json");
}

export async function readBossProfile() {
  const profilePath = getBossProfilePath();
  const raw = await readFile(profilePath, "utf8");
  return {
    profilePath,
    profile: JSON.parse(raw),
  };
}

export async function runBossProfile() {
  const { profilePath, profile } = await readBossProfile();

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      profilePath,
      profile,
    }, null, 2)}\n`,
  );
}
