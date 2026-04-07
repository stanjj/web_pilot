import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getXiaohongshuPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getXiaohongshuUrl() {
  return "https://www.xiaohongshu.com/";
}

export async function getXiaohongshuTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /xiaohongshu\.com/i.test(target.url),
    port,
  );
  if (existing) return existing;
  return createTarget(getXiaohongshuUrl(), port);
}

export async function connectXiaohongshuPage(port = DEFAULT_PORT) {
  const actualPort = getXiaohongshuPort(port);
  const target = await getXiaohongshuTarget(actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
