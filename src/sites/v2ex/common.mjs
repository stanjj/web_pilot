import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getV2exPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getV2exUrl() {
  return "https://www.v2ex.com/";
}

export async function getV2exTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /v2ex\.com/i.test(target.url),
    port,
  );
  if (existing) return existing;
  return createTarget(getV2exUrl(), port);
}

export async function connectV2exPage(port = DEFAULT_PORT) {
  const actualPort = getV2exPort(port);
  const target = await getV2exTarget(actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
