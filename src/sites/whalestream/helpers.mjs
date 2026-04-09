function readText(value) {
  return value == null ? "" : String(value).trim();
}

function readNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function summarizeWhaleStreamStatusSnapshot(snapshot = {}) {
  const url = readText(snapshot.url);
  const title = readText(snapshot.title);
  const message = readText(snapshot.message);
  const topOptionsCount = Math.max(0, readNumber(snapshot.topOptionsCount) ?? 0);
  const newsStatus = readNumber(snapshot.newsStatus);
  const darkPoolStatus = readNumber(snapshot.darkPoolStatus);
  const onWhaleStream = /whalestream\.com/i.test(url) || /whalestream/i.test(title);
  const hasTopOptionsAccess = Boolean(snapshot.hasTopOptionsAccess || topOptionsCount > 0);
  const hasDarkPoolAccess = Boolean(snapshot.hasDarkPoolAccess);
  const hasNewsAccess = Boolean(snapshot.hasNewsAccess);
  const hasSummaryAccess = Boolean(hasTopOptionsAccess || hasDarkPoolAccess);
  const ok = Boolean(onWhaleStream && (hasSummaryAccess || hasNewsAccess));

  return {
    ok,
    status: ok ? "Connected" : onWhaleStream ? "Login or feature access required" : "Unexpected page",
    url,
    title,
    topOptionsCount,
    hasTopOptionsAccess,
    hasDarkPoolAccess,
    hasSummaryAccess,
    hasNewsAccess,
    newsStatus,
    darkPoolStatus,
    message: ok ? "" : message,
  };
}
