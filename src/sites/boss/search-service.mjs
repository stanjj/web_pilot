async function loadBossSearchRuntime() {
  return import("./search-runtime.mjs");
}

export async function searchBossJobs(options, { loadRuntime = loadBossSearchRuntime } = {}) {
  const runtime = await loadRuntime();
  if (typeof runtime?.searchBossJobs !== "function") {
    throw new TypeError("BOSS search runtime is missing searchBossJobs");
  }
  return runtime.searchBossJobs(options);
}