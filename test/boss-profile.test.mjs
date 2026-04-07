import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { ValidationError } from "../src/core/errors.mjs";
import { readBossProfile, normalizeBossProfile } from "../src/sites/boss/profile.mjs";

async function withTempCwd(run) {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(path.join(tmpdir(), "cdp-everything-boss-profile-"));

  try {
    process.chdir(tempDir);
    return await run(tempDir);
  } finally {
    process.chdir(originalCwd);
  }
}

test("readBossProfile returns the built-in template when config is missing", async () => {
  await withTempCwd(async (tempDir) => {
    const result = await readBossProfile();

    assert.equal(result.source, "default-template");
    assert.equal(result.configMissing, true);
    assert.equal(result.profilePath, path.join(tempDir, "config", "boss_profile.zh-CN.json"));
    assert.equal(result.profile["Boss默认沟通语言"], "中文");
    assert.deepEqual(result.profile["候选人"]["目标岗位"], ["后端", "基础设施", "平台工程"]);
  });
});

test("readBossProfile merges partial config values with defaults", async () => {
  await withTempCwd(async (tempDir) => {
    const configDir = path.join(tempDir, "config");
    const profilePath = path.join(configDir, "boss_profile.zh-CN.json");

    await mkdir(configDir, { recursive: true });
    await writeFile(profilePath, JSON.stringify({
      "Boss默认沟通语言": "English",
      "候选人": {
        "姓名": "jimin",
        "目标岗位": ["架构师"],
      },
    }, null, 2));

    const result = await readBossProfile();

    assert.equal(result.source, "config");
    assert.equal(result.configMissing, false);
    assert.equal(result.profile["Boss默认沟通语言"], "English");
    assert.equal(result.profile["候选人"]["姓名"], "jimin");
    assert.equal(result.profile["候选人"]["远程偏好"], "中国远程");
    assert.deepEqual(result.profile["候选人"]["目标岗位"], ["架构师"]);
  });
});

test("normalizeBossProfile rejects malformed candidate data", () => {
  assert.throws(
    () => normalizeBossProfile({ "候选人": "invalid" }),
    ValidationError,
  );
});

test("normalizeBossProfile rejects invalid language and list field types", () => {
  assert.throws(
    () => normalizeBossProfile({ "Boss默认沟通语言": 123 }),
    ValidationError,
  );

  assert.throws(
    () => normalizeBossProfile({ "候选人": { "目标城市": "上海" } }),
    ValidationError,
  );

  assert.throws(
    () => normalizeBossProfile({ "候选人": { "目标岗位": "后端" } }),
    ValidationError,
  );
});

test("readBossProfile surfaces invalid JSON as a validation error with a hint", async () => {
  await withTempCwd(async (tempDir) => {
    const configDir = path.join(tempDir, "config");
    const profilePath = path.join(configDir, "boss_profile.zh-CN.json");

    await mkdir(configDir, { recursive: true });
    await writeFile(profilePath, "{ invalid json", "utf8");

    await assert.rejects(
      () => readBossProfile(),
      (error) => error instanceof ValidationError && /not valid JSON/.test(error.message),
    );
  });
});