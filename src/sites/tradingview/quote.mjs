import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectTradingViewPage, getTradingViewPort, getTradingViewSymbolUrl } from "./common.mjs";
import {
  isTradingViewSymbolMatch,
  parseTradingViewQuoteSnapshot,
  resolveTradingViewSymbolIdentity,
} from "./quote-helpers.mjs";

export {
  extractTradingViewNumber,
  isTradingViewSymbolMatch,
  parseTradingViewQuoteSnapshot,
  resolveTradingViewSymbolIdentity,
} from "./quote-helpers.mjs";

export async function runTradingViewQuote(flags) {
  const requestedSymbol = String(flags.symbol || "").trim();
  if (!requestedSymbol) {
    throw new Error("Missing required --symbol");
  }

  const exchange = String(flags.exchange || "").trim();
  const port = getTradingViewPort(flags.port);
  const { client } = await connectTradingViewPage(port);

  try {
    await navigate(client, getTradingViewSymbolUrl(requestedSymbol, exchange), 5000);

    const snapshot = await evaluate(client, `
      (() => {
        const visibleText = (selector) => Array.from(document.querySelectorAll(selector))
          .find((node) => node && node.textContent && node.textContent.trim() && node.offsetParent !== null)
          ?.textContent?.trim() || '';

        return {
          title: document.title,
          url: location.href,
          symbolInfo: window.initData?.symbolInfo || null,
          lastText: visibleText('.js-symbol-last'),
          currencyText: visibleText('.js-symbol-currency'),
          sessionStatusText: visibleText('.js-symbol-session-status, .tv-market-status__label'),
          changeText: visibleText('.js-symbol-change-direction'),
          lastUpdatedText: visibleText('.js-symbol-lp-time'),
        };
      })()
    `);

    const normalized = parseTradingViewQuoteSnapshot({
      requestedSymbol,
      ...snapshot,
    });

    const symbolMatches = isTradingViewSymbolMatch({
      requestedSymbol,
      exchange,
      resolvedSymbol: snapshot?.symbolInfo?.resolved_symbol || normalized.symbol,
      url: snapshot?.url || normalized.url,
    });
    const resolvedSymbol = resolveTradingViewSymbolIdentity({
      resolvedSymbol: snapshot?.symbolInfo?.resolved_symbol || "",
      url: snapshot?.url || normalized.url,
    });

    if (!snapshot?.symbolInfo && normalized.price == null) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        requestedSymbol: requestedSymbol.toUpperCase(),
        title: snapshot?.title || "",
        url: snapshot?.url || "",
        message: "TradingView symbol page did not expose quote data for this symbol.",
      }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }

    if (!symbolMatches) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        requestedSymbol: normalized.requestedSymbol,
        resolvedSymbol,
        title: normalized.title,
        url: normalized.url,
        message: resolvedSymbol
          ? "TradingView returned quote data for a different symbol than requested."
          : "TradingView quote data could not be verified against the requested symbol.",
      }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }

    process.stdout.write(`${JSON.stringify(normalized, null, 2)}\n`);
    return normalized;
  } finally {
    await client.close();
  }
}