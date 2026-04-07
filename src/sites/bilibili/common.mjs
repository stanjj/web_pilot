import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getBilibiliPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getBilibiliUrl() {
  return "https://www.bilibili.com/";
}

export async function getBilibiliTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /bilibili\.com/i.test(target.url),
    port,
  );
  if (existing) return existing;
  return createTarget(getBilibiliUrl(), port);
}

export async function connectBilibiliPage(port = DEFAULT_PORT) {
  const actualPort = getBilibiliPort(port);
  const target = await getBilibiliTarget(actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
