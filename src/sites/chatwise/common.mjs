import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getChatwisePort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getChatwiseUrl() {
  return "https://chatwise.app/";
}

export async function getChatwiseTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /chatwise/i.test(target.url) || /chatwise/i.test(target.title || ""),
    port,
  );
  if (existing) return existing;
  return createTarget(getChatwiseUrl(), port);
}

export async function connectChatwisePage(port = DEFAULT_PORT) {
  const actualPort = getChatwisePort(port);
  const target = await getChatwiseTarget(actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
