import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getInsiderFinancePort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getInsiderFinanceUrl() {
  return "https://www.insiderfinance.io/";
}

export function getInsiderFinanceFlowUrl() {
  return "https://www.insiderfinance.io/flow";
}

export async function getInsiderFinanceTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /insiderfinance/i.test(target.url) || /insider finance/i.test(target.title || ""),
    port,
  );
  if (existing) return existing;
  return createTarget(getInsiderFinanceUrl(), port);
}

export async function connectInsiderFinancePage(port = DEFAULT_PORT) {
  const actualPort = getInsiderFinancePort(port);
  const target = await getInsiderFinanceTarget(actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
