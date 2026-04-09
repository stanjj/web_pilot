import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";
import { getTradingViewPort, getTradingViewSymbolUrl, getTradingViewUrl } from "./common-helpers.mjs";

export { getTradingViewPort, getTradingViewSymbolUrl, getTradingViewUrl };

export async function getTradingViewTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /(^https?:\/\/)?(www\.)?tradingview\.com/i.test(target.url),
    port,
  );
  if (existing) return existing;
  return createTarget(getTradingViewUrl(), port);
}

export async function connectTradingViewPage(port = DEFAULT_PORT) {
  const actualPort = getTradingViewPort(port);
  const target = await getTradingViewTarget(actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}