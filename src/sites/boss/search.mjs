import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectBossPage, ensureBossPageReady } from "./common.mjs";

const CITY_CODES = {
  all: "100010000",
  beijing: "101010100",
  shanghai: "101020100",
  guangzhou: "101280100",
  shenzhen: "101280600",
  hangzhou: "101210100",
  chengdu: "101270100",
  wuhan: "101200100",
  suzhou: "101190400",
  hongkong: "101320100",
};

function resolveCity(input) {
  if (!input) return CITY_CODES.beijing;
  const key = String(input).toLowerCase();
  if (/^\d+$/.test(key)) return key;
  return CITY_CODES[key] || CITY_CODES.beijing;
}

export function normalizeBossSearchResult(result) {
  if (result?.ok || !result) {
    return result;
  }

  if (Number(result.code) === 37 || /环境存在异常/.test(String(result.message || ""))) {
    return {
      ...result,
      error: "BOSS search is blocked by login or environment verification",
      hint: "Open the shared browser on zhipin.com, complete login or any verification challenge, then retry.",
    };
  }

  return result;
}

export async function searchBossJobs({ query, city, limit = 15, page = 1, port = 9223 }) {
  if (!query) {
    throw new Error("Missing required --query");
  }

  const cityCode = resolveCity(city);
  const pageSize = Math.min(Number(limit ?? 15), 30);
  const { client } = await connectBossPage(port);

  try {
    const webUrl = `https://www.zhipin.com/web/geek/job?query=${encodeURIComponent(query)}&city=${cityCode}`;
    await navigate(client, webUrl, 3000);
    await ensureBossPageReady(client, "job");

    const apiUrl = new URL("https://www.zhipin.com/wapi/zpgeek/search/joblist.json");
    apiUrl.searchParams.set("scene", "1");
    apiUrl.searchParams.set("query", query);
    apiUrl.searchParams.set("city", cityCode);
    apiUrl.searchParams.set("page", String(page));
    apiUrl.searchParams.set("pageSize", String(pageSize));

    const expression = `
      (async () => {
        const response = await fetch(${JSON.stringify(apiUrl.toString())}, {
          credentials: "include",
          headers: { "Accept": "application/json, text/plain, */*" }
        });
        const text = await response.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (error) {
          return { ok: false, error: "JSON parse failed: " + String(error), raw: text.slice(0, 200) };
        }
        if (data.code !== 0) {
          return { ok: false, error: "BOSS API error", code: data.code, message: data.message || "" };
        }
        return {
          ok: true,
          data: (data.zpData?.jobList || []).map((job) => ({
            jobName: job.jobName || "",
            salary: job.salaryDesc || "",
            company: job.brandName || "",
            city: job.cityName || "",
            area: [job.areaDistrict, job.businessDistrict].filter(Boolean).join("·"),
            experience: job.jobExperience || "",
            degree: job.jobDegree || "",
            skills: job.skills || [],
            boss: [job.bossName, job.bossTitle].filter(Boolean).join(" · "),
            securityId: job.securityId || "",
            encryptJobId: job.encryptJobId || "",
            lid: job.lid || "",
            url: job.encryptJobId ? "https://www.zhipin.com/job_detail/" + job.encryptJobId + ".html" : ""
          }))
        };
      })()
    `;

    const result = await evaluate(client, expression);
    return normalizeBossSearchResult(result);
  } finally {
    await client.close();
  }
}

export async function runBossSearch(flags) {
  const result = await searchBossJobs({
    query: flags.query,
    city: flags.city,
    limit: Number(flags.limit ?? 15),
    page: Number(flags.page ?? 1),
    port: Number(flags.port ?? 9223),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result?.ok) process.exitCode = 1;
}
