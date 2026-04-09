import { connectToTarget, createTarget, DEFAULT_PORT, listTargets } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";
import { pickPreferredFeishuTarget } from "./helpers.mjs";

export function getFeishuPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getFeishuUrl() {
  return "https://www.feishu.cn/";
}

export async function getFeishuTarget(port = DEFAULT_PORT) {
  const existing = pickPreferredFeishuTarget(await listTargets(port));
  if (existing) return existing;
  return createTarget(getFeishuUrl(), port);
}

export async function connectFeishuPage(port = DEFAULT_PORT) {
  const actualPort = getFeishuPort(port);
  const target = await getFeishuTarget(actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
