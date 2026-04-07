import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getNotionPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getNotionUrl() {
  return "https://www.notion.so/";
}

export async function getNotionTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /notion\.so/i.test(target.url),
    port,
  );
  if (existing) return existing;
  return createTarget(getNotionUrl(), port);
}

export async function connectNotionPage(port = DEFAULT_PORT) {
  const actualPort = getNotionPort(port);
  const target = await getNotionTarget(actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
