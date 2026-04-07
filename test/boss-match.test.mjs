import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyWorkMode,
  evaluateJob,
  evaluateLocationAndComp,
  parseAnnualComp,
  rankBossJobs,
} from "../src/sites/boss/match.mjs";

test("parseAnnualComp preserves current range, extra-month, and invalid parsing behavior", () => {
  assert.deepEqual(parseAnnualComp("15k-20k·14薪"), {
    ok: true,
    lowAnnual: 210000,
    highAnnual: 210000,
    months: 14,
  });

  assert.deepEqual(parseAnnualComp("25k"), {
    ok: true,
    lowAnnual: 300000,
    highAnnual: 300000,
    months: 12,
  });

  assert.deepEqual(parseAnnualComp("面议"), {
    ok: false,
    lowAnnual: null,
    highAnnual: null,
    months: 12,
  });
});

test("classifyWorkMode preserves explicit mode and marks remote text as pending confirmation", () => {
  assert.equal(
    classifyWorkMode({ jobName: "Senior Backend Engineer", city: "上海", area: "浦东", skills: [] }, "中国远程"),
    "中国远程",
  );

  assert.equal(
    classifyWorkMode({ jobName: "Senior Backend Engineer", city: "Remote", area: "APAC", skills: ["remote"] }),
    "远程待确认",
  );
});

test("evaluateLocationAndComp keeps current remote and onsite thresholds", () => {
  assert.equal(
    evaluateLocationAndComp(
      {
        jobName: "Senior Backend Engineer",
        salary: "26k-30k",
        city: "Remote",
        area: "APAC",
        skills: ["china timezone", "distributed"],
      },
      "中国远程",
    ).matched,
    true,
  );

  const shanghai = evaluateLocationAndComp(
    {
      jobName: "Senior Backend Engineer",
      salary: "55k-60k",
      city: "上海",
      area: "浦东",
      skills: ["java"],
    },
    "现场办公",
  );

  assert.equal(shanghai.threshold, 600000);
  assert.equal(shanghai.matched, true);
});

test("evaluateJob preserves hard excludes and ranking keeps matched jobs first", () => {
  const topJob = {
    jobName: "Staff Backend Engineer",
    salary: "60k-70k",
    city: "上海",
    area: "浦东",
    experience: "8-10年",
    skills: ["java", "distributed", "kubernetes"],
  };
  const secondJob = {
    jobName: "Backend Engineer",
    salary: "40k-45k",
    city: "武汉",
    area: "洪山",
    experience: "5-7年",
    skills: ["go"],
  };
  const excludedJob = {
    jobName: "Frontend Engineer",
    salary: "80k-90k",
    city: "上海",
    area: "徐汇",
    experience: "8-10年",
    skills: ["frontend", "react"],
  };

  const excluded = evaluateJob(excludedJob, "现场办公");
  assert.equal(excluded.matched, false);
  assert.match(excluded.reasons.join(" | "), /硬性排除: frontend/);

  const ranked = rankBossJobs([secondJob, excludedJob, topJob]);
  assert.equal(ranked[0].jobName, "Staff Backend Engineer");
  assert.equal(ranked[0].matched, true);
  assert.equal(ranked[1].jobName, "Backend Engineer");
  assert.equal(ranked[1].matched, true);
  assert.equal(ranked[2].jobName, "Frontend Engineer");
  assert.equal(ranked[2].matched, false);
});
