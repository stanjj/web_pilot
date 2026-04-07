import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getGrokPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getGrokUrl() {
  return "https://grok.com/";
}

export async function getGrokTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /grok\.com/i.test(target.url) || /grok/i.test(target.title || ""),
    port,
  );
  if (existing) return existing;
  return createTarget(getGrokUrl(), port);
}

export async function connectGrokPage(port = DEFAULT_PORT) {
  const actualPort = getGrokPort(port);
  const target = await getGrokTarget(actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
