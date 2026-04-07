import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getSmzdmPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getSmzdmUrl() {
  return "https://www.smzdm.com/";
}

export async function getSmzdmTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /smzdm\.com/i.test(target.url),
    port,
  );
  if (existing) return existing;
  return createTarget(getSmzdmUrl(), port);
}

export async function connectSmzdmPage(port = DEFAULT_PORT) {
  const actualPort = getSmzdmPort(port);
  const target = await getSmzdmTarget(actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
