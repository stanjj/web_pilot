import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getUnusualWhalesPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getUnusualWhalesUrl() {
  return "https://unusualwhales.com/";
}

export function getUnusualWhalesNewsUrl() {
  return "https://unusualwhales.com/news";
}

export function getUnusualWhalesFlowUrl() {
  return "https://unusualwhales.com/live-options-flow/free";
}

export async function getUnusualWhalesTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /unusualwhales/i.test(target.url) || /unusual whales/i.test(target.title || ""),
    port,
  );
  if (existing) return existing;
  return createTarget(getUnusualWhalesUrl(), port);
}

export async function connectUnusualWhalesPage(port = DEFAULT_PORT) {
  const actualPort = getUnusualWhalesPort(port);
  const existing = await findPageTarget(
    (target) => /unusualwhales/i.test(target.url) || /unusual whales/i.test(target.title || ""),
    actualPort,
  );
  const candidates = [];
  if (existing) candidates.push(existing);
  if (!existing) candidates.push(await createTarget(getUnusualWhalesUrl(), actualPort));

  let lastError = null;
  for (const target of candidates) {
    try {
      const client = await connectToTarget(target);
      await autoMinimizeChromeForPort(actualPort);
      return { client, target, port: actualPort };
    } catch (error) {
      lastError = error;
    }
  }

  const freshTarget = await createTarget(getUnusualWhalesUrl(), actualPort);
  const client = await connectToTarget(freshTarget);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target: freshTarget, port: actualPort, recoveredFrom: lastError?.message || null };
}
