import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getChatgptPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getChatgptUrl() {
  return "https://chatgpt.com/";
}

export async function getChatgptTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /chatgpt\.com/i.test(target.url) || /chatgpt/i.test(target.title || ""),
    port,
  );
  if (existing) return existing;
  return createTarget(getChatgptUrl(), port);
}

export async function connectChatgptPage(port = DEFAULT_PORT) {
  const actualPort = getChatgptPort(port);
  const target = await getChatgptTarget(actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
