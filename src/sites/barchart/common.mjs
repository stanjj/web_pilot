import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getBarchartPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getQuoteUrl(symbol) {
  return `https://www.barchart.com/etfs-funds/quotes/${encodeURIComponent(symbol)}/overview`;
}

export function getOptionsUrl(symbol) {
  return `https://www.barchart.com/etfs-funds/quotes/${encodeURIComponent(symbol)}/options`;
}

export function getTechnicalAnalysisUrl(symbol) {
  return `https://www.barchart.com/etfs-funds/quotes/${encodeURIComponent(symbol)}/technical-analysis`;
}

export async function getBarchartTarget(symbol, port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /barchart\.com/i.test(target.url) && target.url.includes(`/${symbol}/`),
    port,
  );
  if (existing) return existing;
  return createTarget(getQuoteUrl(symbol), port);
}

export async function connectBarchartPage(symbol, port = DEFAULT_PORT) {
  const actualPort = getBarchartPort(port);
  const target = await getBarchartTarget(symbol, actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
