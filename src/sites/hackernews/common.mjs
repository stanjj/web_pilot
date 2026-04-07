import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getHackerNewsPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getTopUrl() {
  return "https://news.ycombinator.com/";
}

export async function getHackerNewsTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /news\.ycombinator\.com/i.test(target.url),
    port,
  );
  if (existing) return existing;
  return createTarget(getTopUrl(), port);
}

export async function connectHackerNewsPage(port = DEFAULT_PORT) {
  const actualPort = getHackerNewsPort(port);
  const target = await getHackerNewsTarget(actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
