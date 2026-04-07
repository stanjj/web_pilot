import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getCtripPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getCtripUrl() {
  return "https://www.ctrip.com/";
}

export async function getCtripTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /ctrip\.com/i.test(target.url),
    port,
  );
  if (existing) return existing;
  return createTarget(getCtripUrl(), port);
}

export async function connectCtripPage(port = DEFAULT_PORT) {
  const actualPort = getCtripPort(port);
  const target = await getCtripTarget(actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
