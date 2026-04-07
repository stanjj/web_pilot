import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getJimengPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getJimengUrl() {
  return "https://jimeng.jianying.com/ai-tool/generate?type=image&workspace=0";
}

export async function getJimengTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /jimeng\.jianying\.com/i.test(target.url),
    port,
  );
  if (existing) return existing;
  return createTarget(getJimengUrl(), port);
}

export async function connectJimengPage(port = DEFAULT_PORT) {
  const actualPort = getJimengPort(port);
  const target = await getJimengTarget(actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
