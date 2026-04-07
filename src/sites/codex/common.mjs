import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getCodexPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getCodexUrl() {
  return "https://chatgpt.com/";
}

export async function getCodexTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /chatgpt\.com|openai\.com/i.test(target.url) || /codex|chatgpt|openai/i.test(target.title || ""),
    port,
  );
  if (existing) return existing;
  return createTarget(getCodexUrl(), port);
}

export async function connectCodexPage(port = DEFAULT_PORT) {
  const actualPort = getCodexPort(port);
  const target = await getCodexTarget(actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
