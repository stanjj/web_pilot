import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getWhaleStreamPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getWhaleStreamUrl() {
  return "https://www.whalestream.com/";
}

export function getWhaleStreamNewsUrl() {
  return "https://www.whalestream.com/market-data/news";
}

export function getWhaleStreamTopOptionsUrl() {
  return "https://www.whalestream.com/market-data/top-options-flow";
}

export function getWhaleStreamTopDarkPoolUrl() {
  return "https://www.whalestream.com/market-data/top-dark-pool-flow";
}

export async function getWhaleStreamTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /whalestream/i.test(target.url) || /whalestream/i.test(target.title || ""),
    port,
  );
  if (existing) return existing;
  return createTarget(getWhaleStreamUrl(), port);
}

export async function connectWhaleStreamPage(port = DEFAULT_PORT) {
  const actualPort = getWhaleStreamPort(port);
  const target = await getWhaleStreamTarget(actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
