import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getTradingViewPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getTradingViewUrl() {
  return "https://www.tradingview.com/";
}

export function getTradingViewSymbolUrl(symbol, exchange = "") {
  const rawSymbol = String(symbol || "").trim();
  if (!rawSymbol) {
    throw new Error("Missing required --symbol");
  }

  if (/^https?:\/\//i.test(rawSymbol)) {
    return rawSymbol;
  }

  const normalizedSymbol = rawSymbol.toUpperCase();
  const parts = normalizedSymbol.split(":");
  const explicitExchange = String(exchange || "").trim().toUpperCase();
  const pathSegment = parts.length > 1
    ? `${parts[0]}-${parts.slice(1).join(":")}`
    : (explicitExchange ? `${explicitExchange}-${normalizedSymbol}` : normalizedSymbol);

  return `https://www.tradingview.com/symbols/${encodeURIComponent(pathSegment)}/`;
}

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