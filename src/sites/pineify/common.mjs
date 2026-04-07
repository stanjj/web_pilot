import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getPineifyPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getPineifyUrl() {
  return "https://pineify.app/";
}

export function getPineifyHistoricalFlowUrl() {
  return "https://pineify.app/historical-options-flow-analyzer";
}

export async function getPineifyTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /pineify/i.test(target.url) || /pineify/i.test(target.title || ""),
    port,
  );
  if (existing) return existing;
  return createTarget(getPineifyUrl(), port);
}

export async function connectPineifyPage(port = DEFAULT_PORT) {
  const actualPort = getPineifyPort(port);
  const target = await getPineifyTarget(actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
