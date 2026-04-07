import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getWechatPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getWechatUrl() {
  return "https://web.wechat.com/";
}

export async function getWechatTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /web\.wechat\.com|wx\.qq\.com/i.test(target.url) || /wechat/i.test(target.title || ""),
    port,
  );
  if (existing) return existing;
  return createTarget(getWechatUrl(), port);
}

export async function connectWechatPage(port = DEFAULT_PORT) {
  const actualPort = getWechatPort(port);
  const target = await getWechatTarget(actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
