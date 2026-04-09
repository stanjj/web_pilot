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