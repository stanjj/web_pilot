import { readBossProfile } from "./profile.mjs";
import { searchBossJobs } from "./search-service.mjs";

const ONSITE_THRESHOLDS = {
  "\u4e0a\u6d77": 600000,
  "\u6df1\u5733": 600000,
  "\u5e7f\u5dde": 600000,
  "\u676d\u5dde": 450000,
  "\u82cf\u5dde": 450000,
  "\u6b66\u6c49": 250000,
};

const ROLE_KEYWORDS = [
  "\u540e\u7aef",
  "backend",
  "java",
  "go",
  "golang",
  "c#",
  ".net",
  "\u5e73\u53f0",
  "platform",
  "\u57fa\u7840\u8bbe\u65bd",
  "infra",
  "infrastructure",
  "tech lead",
  "staff",
  "senior software engineer",
];

const STRONG_LEVEL_KEYWORDS = [
  "\u9ad8\u7ea7",
  "\u8d44\u6df1",
  "\u4e13\u5bb6",
  "\u8d1f\u8d23\u4eba",
  "\u67b6\u6784",
  "senior",
  "staff",
  "lead",
  "leader",
  "principal",
];

const EXCLUDE_KEYWORDS = [
  "\u524d\u7aef",
  "frontend",
  "front-end",
  "\u79fb\u52a8\u7aef",
  "ios",
  "android",
  "\u6570\u636e\u5de5\u7a0b",
  "data engineer",
  "data engineering",
  "ml engineer",
  "machine learning",
  "\u673a\u5668\u5b66\u4e60",
];

const DISTRIBUTED_KEYWORDS = [
  "\u5206\u5e03\u5f0f",
  "\u5fae\u670d\u52a1",
  "\u5e73\u53f0",
  "\u57fa\u7840\u8bbe\u65bd",
  "\u4e91",
  "distributed",
  "microservice",
  "platform",
  "infra",
  "infrastructure",
  "aws",
  "azure",
  "kubernetes",
];

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeText(value) {
  return String(value || "").toLowerCase();
}

function parseAnnualComp(salaryText) {
  const text = String(salaryText || "").trim().toLowerCase();
  if (!text) return { ok: false, lowAnnual: null, highAnnual: null, months: null };

  const monthMatch = text.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*k/);
  const singleMatch = text.match(/(\d+(?:\.\d+)?)\s*k/);
  const monthsMatch = text.match(/·\s*(\d+)\s*薪/);
  const months = monthsMatch ? Number(monthsMatch[1]) : 12;

  let lowK = null;
  let highK = null;
  if (monthMatch) {
    lowK = Number(monthMatch[1]);
    highK = Number(monthMatch[2]);
  } else if (singleMatch) {
    lowK = Number(singleMatch[1]);
    highK = Number(singleMatch[1]);
  }

  if (!Number.isFinite(lowK) || !Number.isFinite(highK)) {
    return { ok: false, lowAnnual: null, highAnnual: null, months };
  }

  return {
    ok: true,
    lowAnnual: lowK * 1000 * months,
    highAnnual: highK * 1000 * months,
    months,
  };
}

function classifyWorkMode(job, explicitMode) {
  if (explicitMode) return explicitMode;
  const text = normalizeText([job.jobName, job.city, job.area, ...(job.skills || [])].join(" "));
  if (text.includes("\u8fdc\u7a0b") || text.includes("remote")) {
    return "\u8fdc\u7a0b\u5f85\u786e\u8ba4";
  }
  return "\u73b0\u573a\u529e\u516c";
}

function matchRole(job) {
  const haystack = normalizeText([job.jobName, ...(job.skills || [])].join(" "));
  return ROLE_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

function isStrongEnoughLevel(job) {
  const haystack = normalizeText([job.jobName, job.experience].join(" "));
  if (STRONG_LEVEL_KEYWORDS.some((keyword) => haystack.includes(keyword))) {
    return true;
  }
  if (/\u5728\u6821|\u5e94\u5c4a/.test(job.experience || "")) {
    return false;
  }
  const yearsMatch = String(job.experience || "").match(/(\d+)\s*-\s*(\d+)/);
  if (yearsMatch) {
    return Number(yearsMatch[1]) >= 5;
  }
  return false;
}

function hasHardExclude(job) {
  const haystack = normalizeText([job.jobName, ...(job.skills || []), job.experience].join(" "));
  return EXCLUDE_KEYWORDS.find((keyword) => haystack.includes(keyword)) || null;
}

function evaluateLocationAndComp(job, mode) {
  const salary = parseAnnualComp(job.salary);
  const remoteSupportText = normalizeText([job.jobName, job.city, job.area, ...(job.skills || [])].join(" "));
  const supportsChinaRemote =
    remoteSupportText.includes("\u4e2d\u56fd\u8fdc\u7a0b") ||
    remoteSupportText.includes("\u652f\u6301\u4e2d\u56fd") ||
    remoteSupportText.includes("china timezone") ||
    remoteSupportText.includes("apac") ||
    remoteSupportText.includes("\u4e9a\u592a") ||
    remoteSupportText.includes("\u4e2d\u56fd\u65f6\u533a");

  if (mode === "\u4e2d\u56fd\u8fdc\u7a0b" || mode === "\u6d77\u5916\u8fdc\u7a0b") {
    const threshold = 300000;
    return {
      matched: supportsChinaRemote && salary.ok && salary.lowAnnual > threshold,
      threshold,
      salary,
      reason: supportsChinaRemote ? (salary.ok ? null : "\u65e0\u6cd5\u89e3\u6790\u85aa\u8d44") : "\u8fdc\u7a0b\u4f46\u672a\u660e\u786e\u652f\u6301\u4e2d\u56fd/APAC",
    };
  }

  if (mode === "\u8fdc\u7a0b\u5f85\u786e\u8ba4") {
    return {
      matched: false,
      threshold: 300000,
      salary,
      reason: "\u51fa\u73b0 remote/\u8fdc\u7a0b \u4f46\u641c\u7d22\u7ed3\u679c\u672a\u660e\u786e\u652f\u6301\u4e2d\u56fd/APAC",
    };
  }

  const threshold = ONSITE_THRESHOLDS[job.city] ?? null;
  if (!threshold) {
    return {
      matched: false,
      threshold: null,
      salary,
      reason: "\u73b0\u573a\u57ce\u5e02\u4e0d\u5728\u5141\u8bb8\u5217\u8868",
    };
  }

  return {
    matched: salary.ok && salary.lowAnnual > threshold,
    threshold,
    salary,
    reason: salary.ok ? null : "\u65e0\u6cd5\u89e3\u6790\u85aa\u8d44",
  };
}

function scoreJob(job) {
  const text = normalizeText([job.jobName, ...(job.skills || [])].join(" "));
  let score = 0;
  if (text.includes("java") || text.includes("go") || text.includes("golang")) score += 30;
  if (STRONG_LEVEL_KEYWORDS.some((keyword) => text.includes(keyword))) score += 25;
  if (DISTRIBUTED_KEYWORDS.some((keyword) => text.includes(keyword))) score += 20;
  return score;
}

function evaluateJob(job, mode) {
  const hardExclude = hasHardExclude(job);
  const roleMatched = matchRole(job);
  const levelMatched = isStrongEnoughLevel(job);
  const locationComp = evaluateLocationAndComp(job, mode);
  const matched = !hardExclude && roleMatched && levelMatched && locationComp.matched;

  const reasons = [];
  if (hardExclude) reasons.push(`\u786c\u6027\u6392\u9664: ${hardExclude}`);
  if (!roleMatched) reasons.push("\u5c97\u4f4d\u65b9\u5411\u4e0d\u5339\u914d");
  if (!levelMatched) reasons.push("\u7ea7\u522b\u4f4e\u4e8e\u9ad8\u7ea7\u8981\u6c42");
  if (!locationComp.matched) {
    reasons.push(locationComp.reason || `\u85aa\u8d44\u672a\u8d85\u8fc7\u95e8\u69db ${locationComp.threshold ?? "N/A"}`);
  }

  return {
    ...job,
    workMode: mode,
    annualComp: locationComp.salary,
    threshold: locationComp.threshold,
    matched,
    score: scoreJob(job),
    reasons,
  };
}

function normalizeJobFromFlags(flags) {
  return {
    jobName: String(flags["job-name"] || ""),
    salary: String(flags.salary || ""),
    company: String(flags.company || ""),
    city: String(flags.city || ""),
    area: String(flags.area || ""),
    experience: String(flags.experience || ""),
    degree: String(flags.degree || ""),
    skills: String(flags.skills || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    boss: String(flags.boss || ""),
    url: String(flags.url || ""),
  };
}

export function rankBossJobs(jobs, explicitMode = null) {
  return [...(Array.isArray(jobs) ? jobs : [])]
    .map((job) => evaluateJob(job, classifyWorkMode(job, explicitMode)))
    .sort((left, right) => {
      if (Number(right.matched) !== Number(left.matched)) return Number(right.matched) - Number(left.matched);
      return right.score - left.score;
    });
}

export {
  parseAnnualComp,
  classifyWorkMode,
  matchRole,
  isStrongEnoughLevel,
  hasHardExclude,
  evaluateLocationAndComp,
  scoreJob,
  evaluateJob,
  normalizeJobFromFlags,
};

export async function runBossMatchJob(flags) {
  const { profilePath, profile } = await readBossProfile();
  const mode = String(flags.mode || "").trim() || null;

  let jobs = [];
  if (flags.query) {
    const result = await searchBossJobs({
      query: flags.query,
      city: flags.city,
      limit: toNumber(flags.limit, 10),
      page: toNumber(flags.page, 1),
      port: toNumber(flags.port, 9223),
    });
    if (!result?.ok) {
      throw new Error(result?.error || "BOSS search failed");
    }
    jobs = result.data || [];
  } else {
    jobs = [normalizeJobFromFlags(flags)];
  }

  const evaluated = rankBossJobs(jobs, mode);

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      profilePath,
      沟通语言: profile["Boss默认沟通语言"],
      候选人: profile["候选人"],
      jobsEvaluated: evaluated.length,
      matchedCount: evaluated.filter((item) => item.matched).length,
      items: evaluated,
    }, null, 2)}\n`,
  );
}
