function readText(value) {
  return value == null ? "" : String(value).trim();
}

export function summarizeMarketBeatPage(snapshot = {}) {
  const url = readText(snapshot.url);
  const title = readText(snapshot.title);
  const bodyText = readText(snapshot.bodyText);
  const onMarketBeat = /marketbeat\.com/i.test(url) || /marketbeat/i.test(title);
  const blocked = /just a moment|verify you are human|enable javascript and cookies|checking your browser/i.test(`${title}\n${bodyText}`);
  const ready = Boolean(onMarketBeat && !blocked);

  return {
    ok: ready,
    status: ready ? "Connected" : blocked ? "Blocked" : "Unexpected page",
    url,
    title,
    blocked,
  };
}

export function ensureMarketBeatReady(snapshot = {}) {
  const summary = summarizeMarketBeatPage(snapshot);
  if (summary.ok) {
    return summary;
  }

  const error = new Error(summary.blocked
    ? "MarketBeat is currently behind a bot or Cloudflare challenge in the shared browser."
    : "MarketBeat did not load an expected page in the shared browser.");
  error.code = summary.blocked ? "MARKETBEAT_BLOCKED" : "MARKETBEAT_UNREADY";
  error.details = summary;
  throw error;
}

export function ensureMarketBeatPath(snapshot = {}, expectedPath = "") {
  const url = readText(snapshot.url);
  if (!expectedPath || url.includes(expectedPath)) {
    return snapshot;
  }

  const error = new Error(`MarketBeat did not stay on the expected page: ${expectedPath}`);
  error.code = "MARKETBEAT_REDIRECTED";
  error.details = {
    url,
    title: readText(snapshot.title),
    expectedPath,
  };
  throw error;
}
