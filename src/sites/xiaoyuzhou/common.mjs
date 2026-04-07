import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getXiaoyuzhouPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getXiaoyuzhouUrl(path = "/") {
  return `https://www.xiaoyuzhoufm.com${path}`;
}

export async function getXiaoyuzhouTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /xiaoyuzhoufm\.com/i.test(target.url),
    port,
  );
  if (existing) return existing;
  return createTarget(getXiaoyuzhouUrl(), port);
}

export async function connectXiaoyuzhouPage(port = DEFAULT_PORT) {
  const actualPort = getXiaoyuzhouPort(port);
  const target = await getXiaoyuzhouTarget(actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
