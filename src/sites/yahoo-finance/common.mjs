import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";
import { getEarningsUrl, getQuoteUrl, getYahooFinancePort } from "./common-helpers.mjs";

export { getEarningsUrl, getQuoteUrl, getYahooFinancePort };

export async function getYahooFinanceTarget(symbol, port = DEFAULT_PORT) {
  const normalized = `/${symbol.toUpperCase()}`;
  const existing = await findPageTarget(
    (target) => /finance\.yahoo\.com/i.test(target.url) && target.url.toUpperCase().includes(normalized),
    port,
  );
  if (existing) return existing;
  return createTarget(getQuoteUrl(symbol), port);
}

export async function connectYahooFinancePage(symbol, port = DEFAULT_PORT) {
  const actualPort = getYahooFinancePort(port);
  const target = await getYahooFinanceTarget(symbol, actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
