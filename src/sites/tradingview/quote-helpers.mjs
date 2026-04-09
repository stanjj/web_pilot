function cleanTradingViewText(value) {
  return String(value ?? "")
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/[−–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractTradingViewNumber(text) {
  const normalized = cleanTradingViewText(text).replace(/,/g, "");
  const match = normalized.match(/(-?\d+(?:\.\d+)?)\s*([KMBT])?/i);
  if (!match) return null;

  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;

  const suffix = String(match[2] || "").toUpperCase();
  const factors = {
    K: 1_000,
    M: 1_000_000,
    B: 1_000_000_000,
    T: 1_000_000_000_000,
  };

  return value * (factors[suffix] || 1);
}

function parseTradingViewIdentity(value) {
  const normalized = cleanTradingViewText(value).toUpperCase();
  if (!normalized || /^HTTPS?:\/\//.test(normalized)) {
    return null;
  }

  const colonIndex = normalized.indexOf(":");
  if (colonIndex > 0) {
    return {
      exchange: normalized.slice(0, colonIndex),
      symbol: normalized.slice(colonIndex + 1),
    };
  }

  return {
    exchange: "",
    symbol: normalized,
  };
}

function parseTradingViewIdentityFromUrl(value) {
  try {
    const parsed = new URL(String(value || ""));
    const match = parsed.pathname.match(/\/symbols\/([^/?#]+)/i);
    if (!match) {
      return null;
    }

    const segment = cleanTradingViewText(decodeURIComponent(match[1])).toUpperCase();
    const dashIndex = segment.indexOf("-");
    if (dashIndex > 0) {
      return {
        exchange: segment.slice(0, dashIndex),
        symbol: segment.slice(dashIndex + 1),
      };
    }

    return {
      exchange: "",
      symbol: segment,
    };
  } catch {
    return null;
  }
}

function formatTradingViewIdentity(identity) {
  if (!identity?.symbol) {
    return "";
  }

  return identity.exchange ? `${identity.exchange}:${identity.symbol}` : identity.symbol;
}

export function resolveTradingViewSymbolIdentity({ resolvedSymbol = "", url = "" } = {}) {
  return formatTradingViewIdentity(
    parseTradingViewIdentity(resolvedSymbol) || parseTradingViewIdentityFromUrl(url),
  );
}

export function isTradingViewSymbolMatch({
  requestedSymbol = "",
  exchange = "",
  resolvedSymbol = "",
  url = "",
} = {}) {
  if (/^https?:\/\//i.test(String(requestedSymbol || "").trim())) {
    return true;
  }

  const expected = parseTradingViewIdentity(
    String(requestedSymbol || "").includes(":")
      ? requestedSymbol
      : (exchange ? `${exchange}:${requestedSymbol}` : requestedSymbol),
  );
  const actual = parseTradingViewIdentity(resolvedSymbol) || parseTradingViewIdentityFromUrl(url);

  if (!expected?.symbol || !actual?.symbol) {
    return false;
  }

  if (expected.symbol !== actual.symbol) {
    return false;
  }

  if (expected.exchange && actual.exchange) {
    return expected.exchange === actual.exchange;
  }

  return true;
}

export function parseTradingViewQuoteSnapshot({
  requestedSymbol = "",
  title = "",
  url = "",
  symbolInfo = {},
  lastText = "",
  currencyText = "",
  sessionStatusText = "",
  changeText = "",
  lastUpdatedText = "",
} = {}) {
  const normalizedRequestedSymbol = cleanTradingViewText(requestedSymbol).toUpperCase();
  const info = symbolInfo && typeof symbolInfo === "object" ? symbolInfo : {};
  let changeParts = String(changeText || "")
    .split(/\r?\n/)
    .map(cleanTradingViewText)
    .filter(Boolean);
  if (changeParts.length < 2) {
    const compactMatches = cleanTradingViewText(changeText).match(/-?\d[\d,]*(?:\.\d+)?%?/g) || [];
    if (compactMatches.length >= 2) {
      changeParts = [compactMatches[0], compactMatches[1]];
    }
  }
  const country = cleanTradingViewText(info.country_code_fund || info.country || "").toUpperCase();

  return {
    ok: true,
    requestedSymbol: normalizedRequestedSymbol,
    symbol: cleanTradingViewText(info.resolved_symbol || normalizedRequestedSymbol),
    title: String(title ?? "").trim(),
    url: String(url ?? "").trim(),
    name: cleanTradingViewText(info.description || info.short_description || ""),
    shortName: cleanTradingViewText(info.short_name || normalizedRequestedSymbol.split(":").pop() || ""),
    instrumentType: cleanTradingViewText(info.type || ""),
    exchange: cleanTradingViewText(info.exchange || ""),
    exchangeDisplay: cleanTradingViewText(info.exchange_for_display || info.exchange || ""),
    market: cleanTradingViewText(info.source2?.name || info.source2?.description || ""),
    currency: cleanTradingViewText(currencyText || info.currency || info.currency_code || ""),
    country,
    isin: cleanTradingViewText(info.isin_displayed || ""),
    price: extractTradingViewNumber(lastText),
    change: extractTradingViewNumber(changeParts[0] || ""),
    changePct: extractTradingViewNumber(changeParts[1] || ""),
    sessionStatus: cleanTradingViewText(sessionStatusText),
    lastUpdated: cleanTradingViewText(lastUpdatedText),
    hasFundamentals: Boolean(info.has_fundamentals),
    hasPriceSnapshot: Boolean(info.has_price_snapshot),
  };
}