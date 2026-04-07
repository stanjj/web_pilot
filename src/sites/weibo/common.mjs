import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getWeiboPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getWeiboUrl() {
  return "https://weibo.com/";
}

export async function getWeiboTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /weibo\.com/i.test(target.url),
    port,
  );
  if (existing) return existing;
  return createTarget(getWeiboUrl(), port);
}

export async function connectWeiboPage(port = DEFAULT_PORT) {
  const actualPort = getWeiboPort(port);
  const target = await getWeiboTarget(actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
