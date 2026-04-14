import { runSitePlaceholder } from "../../core/site-placeholder.mjs";

export async function runPlaceholder(flags = {}) {
  return runSitePlaceholder("tradingview", flags);
}

export { runTradingViewTechnicals } from "./technicals.mjs";