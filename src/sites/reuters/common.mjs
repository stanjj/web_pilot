import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getReutersPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getReutersUrl() {
  return "https://www.reuters.com/";
}

export async function getReutersTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /reuters\.com/i.test(target.url),
    port,
  );
  if (existing) return existing;
  return createTarget(getReutersUrl(), port);
}

export async function connectReutersPage(port = DEFAULT_PORT) {
  const actualPort = getReutersPort(port);
  const target = await getReutersTarget(actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
