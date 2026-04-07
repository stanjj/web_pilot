import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getTwitterPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getTwitterUrl() {
  return "https://x.com/explore/tabs/trending";
}

export async function getTwitterTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /(^https?:\/\/)?(www\.)?(x\.com|twitter\.com)/i.test(target.url),
    port,
  );
  if (existing) return existing;
  return createTarget(getTwitterUrl(), port);
}

export async function connectTwitterPage(port = DEFAULT_PORT) {
  const actualPort = getTwitterPort(port);
  const target = await getTwitterTarget(actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
