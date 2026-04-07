import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getRedditPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getRedditUrl() {
  return "https://www.reddit.com/";
}

export async function getRedditTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /reddit\.com/i.test(target.url),
    port,
  );
  if (existing) return existing;
  return createTarget(getRedditUrl(), port);
}

export async function connectRedditPage(port = DEFAULT_PORT) {
  const actualPort = getRedditPort(port);
  const target = await getRedditTarget(actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
