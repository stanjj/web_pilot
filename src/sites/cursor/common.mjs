import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getCursorPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getCursorUrl() {
  return "https://www.cursor.com/";
}

export async function getCursorTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /cursor/i.test(target.url) || /cursor/i.test(target.title || ""),
    port,
  );
  if (existing) return existing;
  return createTarget(getCursorUrl(), port);
}

export async function connectCursorPage(port = DEFAULT_PORT) {
  const actualPort = getCursorPort(port);
  const target = await getCursorTarget(actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
