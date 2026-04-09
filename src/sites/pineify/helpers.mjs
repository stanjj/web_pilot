function readText(value) {
  return value == null ? "" : String(value).trim();
}

function readNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function summarizePineifyStatusSnapshot(snapshot = {}) {
  const url = readText(snapshot.url);
  const title = readText(snapshot.title);
  const message = readText(snapshot.message);
  const apiStatus = readNumber(snapshot.apiStatus);
  const tokenLength = Math.max(0, readNumber(snapshot.tokenLength) ?? 0);
  const onPineify = /pineify\.app/i.test(url) || /pineify/i.test(title);
  const hasSiteToken = typeof snapshot.hasSiteToken === "boolean"
    ? snapshot.hasSiteToken
    : tokenLength > 8;
  const hasHistoricalFlowAccess = Boolean(onPineify && apiStatus === 200 && hasSiteToken);
  const ok = hasHistoricalFlowAccess;

  return {
    ok,
    status: ok ? "Connected" : onPineify ? "Login or feature access required" : "Unexpected page",
    url,
    title,
    apiStatus,
    hasSiteToken,
    tokenLength,
    hasHistoricalFlowAccess,
    message: ok ? "" : message,
  };
}
