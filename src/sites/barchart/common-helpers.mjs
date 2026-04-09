import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";

const DEFAULT_PORT = 9223;

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