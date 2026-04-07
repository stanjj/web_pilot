import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getAntigravityPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getAntigravityUrl() {
  return "https://www.antigravity.ai/";
}

export async function getAntigravityTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /antigravity/i.test(target.url) || /antigravity/i.test(target.title || ""),
    port,
  );
  if (existing) return existing;
  return createTarget(getAntigravityUrl(), port);
}

export async function connectAntigravityPage(port = DEFAULT_PORT) {
  const actualPort = getAntigravityPort(port);
  const target = await getAntigravityTarget(actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
