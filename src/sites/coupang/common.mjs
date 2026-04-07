import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getCoupangPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getCoupangUrl() {
  return "https://www.coupang.com/";
}

export async function getCoupangTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /coupang\.com/i.test(target.url),
    port,
  );
  if (existing) return existing;
  return createTarget(getCoupangUrl(), port);
}

export async function connectCoupangPage(port = DEFAULT_PORT) {
  const actualPort = getCoupangPort(port);
  const target = await getCoupangTarget(actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
