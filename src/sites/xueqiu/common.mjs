import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getXueqiuPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getXueqiuUrl() {
  return "https://xueqiu.com/";
}

export async function getXueqiuTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /xueqiu\.com/i.test(target.url),
    port,
  );
  if (existing) return existing;
  return createTarget(getXueqiuUrl(), port);
}

export async function connectXueqiuPage(port = DEFAULT_PORT) {
  const actualPort = getXueqiuPort(port);
  const target = await getXueqiuTarget(actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
