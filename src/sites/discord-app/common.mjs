import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getDiscordPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getDiscordUrl() {
  return "https://discord.com/app";
}

export async function getDiscordTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /discord\.com/i.test(target.url),
    port,
  );
  if (existing) return existing;
  return createTarget(getDiscordUrl(), port);
}

export async function connectDiscordPage(port = DEFAULT_PORT) {
  const actualPort = getDiscordPort(port);
  const target = await getDiscordTarget(actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
