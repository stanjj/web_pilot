import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";

const DEFAULT_PORT = 9223;

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