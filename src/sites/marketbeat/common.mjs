import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getMarketBeatPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getMarketBeatUrl() {
  return "https://www.marketbeat.com/";
}

export function getMarketBeatHeadlinesUrl() {
  return "https://www.marketbeat.com/";
}

export function getMarketBeatUnusualCallUrl() {
  return "https://www.marketbeat.com/market-data/unusual-call-options-volume/";
}

export function getMarketBeatUnusualPutUrl() {
  return "https://www.marketbeat.com/market-data/unusual-put-options-volume/";
}

export async function getMarketBeatTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /marketbeat/i.test(target.url) || /marketbeat/i.test(target.title || ""),
    port,
  );
  if (existing) return existing;
  return createTarget(getMarketBeatUrl(), port);
}

export async function connectMarketBeatPage(port = DEFAULT_PORT) {
  const actualPort = getMarketBeatPort(port);
  const target = await getMarketBeatTarget(actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
