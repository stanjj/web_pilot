import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getNeteaseMusicPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getNeteaseMusicUrl() {
  return "https://music.163.com/";
}

export async function getNeteaseMusicTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /music\.163\.com/i.test(target.url),
    port,
  );
  if (existing) return existing;
  return createTarget(getNeteaseMusicUrl(), port);
}

export async function connectNeteaseMusicPage(port = DEFAULT_PORT) {
  const actualPort = getNeteaseMusicPort(port);
  const target = await getNeteaseMusicTarget(actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
