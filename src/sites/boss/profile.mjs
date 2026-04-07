import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { ValidationError } from "../../core/errors.mjs";

const DEFAULT_BOSS_PROFILE = Object.freeze({
  "Boss默认沟通语言": "中文",
  "候选人": {
    "姓名": "",
    "当前城市": "",
    "目标城市": [],
    "目标岗位": ["后端", "基础设施", "平台工程"],
    "远程偏好": "中国远程",
    "年薪底线": 300000,
  },
});

function cloneBossProfileTemplate() {
  return JSON.parse(JSON.stringify(DEFAULT_BOSS_PROFILE));
}

function normalizeBossCandidate(candidate = {}) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new ValidationError("BOSS profile field \"候选人\" must be an object", {
      hint: "Update config/boss_profile.zh-CN.json so 候选人 is a JSON object.",
    });
  }

  if ("目标城市" in candidate && candidate["目标城市"] !== undefined && !Array.isArray(candidate["目标城市"])) {
    throw new ValidationError("BOSS profile field \"候选人.目标城市\" must be an array", {
      hint: "Update config/boss_profile.zh-CN.json so 候选人.目标城市 is a JSON array.",
    });
  }

  if ("目标岗位" in candidate && candidate["目标岗位"] !== undefined && !Array.isArray(candidate["目标岗位"])) {
    throw new ValidationError("BOSS profile field \"候选人.目标岗位\" must be an array", {
      hint: "Update config/boss_profile.zh-CN.json so 候选人.目标岗位 is a JSON array.",
    });
  }

  const template = cloneBossProfileTemplate()["候选人"];
  return {
    ...template,
    ...candidate,
    "目标城市": Array.isArray(candidate["目标城市"]) ? [...candidate["目标城市"]] : template["目标城市"],
    "目标岗位": Array.isArray(candidate["目标岗位"]) ? [...candidate["目标岗位"]] : template["目标岗位"],
  };
}

export function normalizeBossProfile(profile = {}) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    throw new ValidationError("BOSS profile must be a JSON object", {
      hint: "Update config/boss_profile.zh-CN.json to contain a top-level JSON object.",
    });
  }

  if (
    "Boss默认沟通语言" in profile &&
    profile["Boss默认沟通语言"] !== undefined &&
    typeof profile["Boss默认沟通语言"] !== "string"
  ) {
    throw new ValidationError("BOSS profile field \"Boss默认沟通语言\" must be a string", {
      hint: "Update config/boss_profile.zh-CN.json so Boss默认沟通语言 is a string.",
    });
  }

  return {
    ...cloneBossProfileTemplate(),
    ...(profile["Boss默认沟通语言"] !== undefined
      ? { "Boss默认沟通语言": profile["Boss默认沟通语言"] }
      : {}),
    "候选人": normalizeBossCandidate(profile["候选人"]),
  };
}

export function getBossProfilePath() {
  return resolve(process.cwd(), "config", "boss_profile.zh-CN.json");
}

export async function readBossProfile() {
  const profilePath = getBossProfilePath();
  try {
    const raw = await readFile(profilePath, "utf8");
    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new ValidationError("BOSS profile config is not valid JSON", {
        hint: "Fix config/boss_profile.zh-CN.json so it contains valid JSON.",
        details: { profilePath, cause: error.message },
      });
    }

    return {
      profilePath,
      profile: normalizeBossProfile(parsed),
      source: "config",
      configMissing: false,
    };
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }

    return {
      profilePath,
      profile: cloneBossProfileTemplate(),
      source: "default-template",
      configMissing: true,
    };
  }
}

export async function runBossProfile() {
  const { profilePath, profile, source, configMissing } = await readBossProfile();

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      profilePath,
      profile,
      source,
      configMissing,
    }, null, 2)}\n`,
  );
}
