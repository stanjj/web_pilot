import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getZhihuPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getZhihuUrl() {
  return "https://www.zhihu.com/";
}

export async function getZhihuTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /zhihu\.com/i.test(target.url),
    port,
  );
  if (existing) return existing;
  return createTarget(getZhihuUrl(), port);
}

export async function connectZhihuPage(port = DEFAULT_PORT) {
  const actualPort = getZhihuPort(port);
  const target = await getZhihuTarget(actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
