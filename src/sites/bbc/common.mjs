import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getBbcPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getBbcNewsUrl() {
  return "https://feeds.bbci.co.uk/news/rss.xml";
}

export async function getBbcTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /feeds\.bbci\.co\.uk/i.test(target.url) || /bbc\.com/i.test(target.url),
    port,
  );
  if (existing) return existing;
  return createTarget(getBbcNewsUrl(), port);
}

export async function connectBbcPage(port = DEFAULT_PORT) {
  const actualPort = getBbcPort(port);
  const target = await getBbcTarget(actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
