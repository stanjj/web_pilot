import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getLinuxDoPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getLinuxDoUrl() {
  return "https://linux.do/";
}

export async function getLinuxDoTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /linux\.do/i.test(target.url),
    port,
  );
  if (existing) return existing;
  return createTarget(getLinuxDoUrl(), port);
}

export async function connectLinuxDoPage(port = DEFAULT_PORT) {
  const actualPort = getLinuxDoPort(port);
  const target = await getLinuxDoTarget(actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
