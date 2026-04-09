import { normalizeBossSearchResult } from "./search-helpers.mjs";
import { searchBossJobs } from "./search-service.mjs";

export { normalizeBossSearchResult } from "./search-helpers.mjs";
export { searchBossJobs } from "./search-service.mjs";

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
