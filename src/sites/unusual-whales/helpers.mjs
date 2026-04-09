function readText(value) {
  return value == null ? "" : String(value).trim();
}

function readNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function summarizeUnusualWhalesStatusSnapshot(snapshot = {}) {
  const url = readText(snapshot.url);
  const title = readText(snapshot.title);
  const message = readText(snapshot.message);
  const apiStatus = readNumber(snapshot.apiStatus);
  const sampleCount = Math.max(0, readNumber(snapshot.sampleCount) ?? 0);
  const onUnusualWhales = /unusualwhales\.com/i.test(url) || /unusual whales/i.test(title) || /unusualwhales/i.test(title);
  const hasFlowAccess = Boolean(onUnusualWhales && apiStatus === 200 && snapshot.hasFlowArray);
  const ok = hasFlowAccess;

  return {
    ok,
    status: ok ? "Connected" : onUnusualWhales ? "Login or feature access required" : "Unexpected page",
    url,
    title,
    apiStatus,
    hasFlowAccess,
    sampleCount,
    message: ok ? "" : message,
  };
}
