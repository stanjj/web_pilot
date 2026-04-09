import { classifyMoneyness } from "./options-helpers.mjs";

export const BARCHART_FLOW_FIELDS = [
  "baseSymbol",
  "strikePrice",
  "expirationDate",
  "optionType",
  "lastPrice",
  "volume",
  "openInterest",
  "volumeOpenInterestRatio",
  "volatility",
  "percentFromLast",
];

function round(value, digits = 2) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Number(Number(value).toFixed(digits));
}

function normalizeLimit(limit, fallback = 20) {
  return Number.isFinite(limit) ? Math.max(1, limit) : fallback;
}

export function normalizeBarchartFlowType(type) {
  return String(type || "all").trim().toLowerCase();
}

function deriveUnderlyingPriceFromPercentFromLast(strike, percentFromLast) {
  const numericStrike = Number(strike);
  const pct = Number(percentFromLast);
  if (!Number.isFinite(numericStrike) || !Number.isFinite(pct) || pct === -100) {
    return null;
  }
  return numericStrike / (1 + pct / 100);
}

function parseDaysToExpiration(expirationDate) {
  const raw = String(expirationDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return null;
  }

  const expiryMs = Date.parse(`${raw}T00:00:00Z`);
  if (!Number.isFinite(expiryMs)) {
    return null;
  }

  const today = new Date();
  const utcTodayMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((expiryMs - utcTodayMs) / 86400000);
}

function formatPremium(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (Math.abs(num) >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(num) >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (Math.abs(num) >= 1_000) return `$${(num / 1_000).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
}

function toBarchartFlowItem(row) {
  const normalized = row?.raw || row || {};
  const strike = round(normalized.strikePrice);
  const last = round(normalized.lastPrice);
  const volume = normalized.volume ?? null;
  const openInterest = normalized.openInterest ?? null;
  const volumeOpenInterestRatio = round(normalized.volumeOpenInterestRatio);
  const percentFromLast = round(normalized.percentFromLast);
  const underlyingPrice = round(
    deriveUnderlyingPriceFromPercentFromLast(normalized.strikePrice, normalized.percentFromLast),
  );
  const moneyness = classifyMoneyness(strike, underlyingPrice, normalized.optionType || "");
  const premiumValue = Number.isFinite(Number(volume)) && Number.isFinite(Number(last))
    ? Number(volume) * Number(last) * 100
    : null;
  const daysToExpiration = parseDaysToExpiration(normalized.expirationDate);

  return {
    symbol: normalized.baseSymbol || normalized.symbol || "",
    type: normalized.optionType || "",
    strike,
    expiration: normalized.expirationDate || "",
    last,
    volume,
    openInterest,
    volOiRatio: volumeOpenInterestRatio,
    volumeOpenInterestRatio,
    iv: round(normalized.volatility),
    percentFromLast,
    underlyingPrice,
    moneyness,
    nearAtm: moneyness === "atm" || (percentFromLast != null && Math.abs(percentFromLast) <= 1),
    daysToExpiration,
    nearExpiry: daysToExpiration != null && daysToExpiration >= 0 && daysToExpiration <= 7,
    premiumValue,
    premium: formatPremium(premiumValue),
  };
}

function filterBarchartFlowRows(rows, { type = "all", symbol = null } = {}) {
  const normalizedType = normalizeBarchartFlowType(type);
  const normalizedSymbol = symbol ? String(symbol).trim().toUpperCase() : null;

  return [...(Array.isArray(rows) ? rows : [])]
    .map((item) => item?.raw || item)
    .filter((row) => {
      if (!row) return false;

      if (normalizedSymbol) {
        const rowSymbol = String(row.baseSymbol || row.symbol || "").trim().toUpperCase();
        if (rowSymbol !== normalizedSymbol) {
          return false;
        }
      }

      if (normalizedType !== "all") {
        return String(row.optionType || "").toLowerCase() === normalizedType;
      }

      return true;
    });
}

function createBarchartFlowFailure(result, { type, symbol = null, message } = {}) {
  const normalized = {
    ok: false,
    type: normalizeBarchartFlowType(type),
    status: result?.status ?? null,
    needsLogin: result?.code === "needs-login" || result?.code === "no-csrf",
    message,
    body: result?.body || result?.message || "",
  };

  if (symbol) {
    normalized.symbol = String(symbol).trim().toUpperCase();
  }

  return normalized;
}

function rankBarchartFlowItems(items) {
  const premiumOrder = [...items]
    .map((item, index) => ({ index, premiumValue: item.premiumValue ?? -Infinity }))
    .sort((left, right) => right.premiumValue - left.premiumValue)
    .map((entry, index) => ({ ...entry, premiumRank: index + 1 }));
  const premiumRankByIndex = new Map(premiumOrder.map((entry) => [entry.index, entry.premiumRank]));
  return items.map((item, index) => ({
    ...item,
    premiumRank: premiumRankByIndex.get(index) ?? null,
  }));
}

function parseBarchartFlowItemsFromResponse(response, { type = "all", limit = 20, symbol = null } = {}) {
  let json;
  try {
    json = JSON.parse(String(response?.text || ""));
  } catch {
    return null;
  }

  const rows = Array.isArray(json?.data) ? json.data : [];
  if (rows.length === 0) {
    return null;
  }

  const filteredRows = filterBarchartFlowRows(rows, {
    symbol,
    type,
  });
  if (filteredRows.length === 0) {
    return null;
  }

  return rankBarchartFlowItems(
    filteredRows
      .slice(0, normalizeLimit(limit))
      .map(toBarchartFlowItem),
  );
}

export function parseBarchartFlowResponses(result, { type = "all", limit = 20 } = {}) {
  const normalizedType = normalizeBarchartFlowType(type);
  const maxItems = normalizeLimit(limit);

  if (!result?.ok) {
    return createBarchartFlowFailure(result, {
      type: normalizedType,
      message: "Barchart options flow requires a valid session in the shared agent browser.",
    });
  }

  for (const response of result.responses || []) {
    if (!response?.ok) {
      if (response?.status === 401 || response?.status === 403) {
        return createBarchartFlowFailure(
          {
            code: "needs-login",
            status: response.status,
            body: String(response.text || "").slice(0, 300),
          },
          {
            type: normalizedType,
            message: "Barchart options flow requires a valid session in the shared agent browser.",
          },
        );
      }
      continue;
    }

    const items = parseBarchartFlowItemsFromResponse(response, {
      type: normalizedType,
      limit: maxItems,
    });
    if (!items) {
      continue;
    }
    return {
      ok: true,
      type: normalizedType,
      sourceList: response.list || null,
      count: items.length,
      items,
    };
  }

  return {
    ok: true,
    type: normalizedType,
    sourceList: null,
    count: 0,
    items: [],
  };
}

export function parseBarchartFlowSymbolResponse(result, { symbol, type = "all", limit = 20 } = {}) {
  const normalizedType = normalizeBarchartFlowType(type);
  const normalizedSymbol = String(symbol || "").trim().toUpperCase();
  const maxItems = normalizeLimit(limit);

  if (!result?.ok) {
    return createBarchartFlowFailure(result, {
      symbol: normalizedSymbol,
      type: normalizedType,
      message: "Barchart symbol flow requires a valid session in the shared agent browser.",
    });
  }

  const responses = Array.isArray(result.responses)
    ? result.responses
    : result.response
      ? [result.response]
      : [];
  let sawSuccessfulResponse = false;
  let lastFailure = null;

  for (const response of responses) {
    if (!response?.ok) {
      if (response?.status === 401 || response?.status === 403) {
        return createBarchartFlowFailure(
          {
            code: "needs-login",
            status: response?.status ?? null,
            body: String(response?.text || "").slice(0, 300),
          },
          {
            symbol: normalizedSymbol,
            type: normalizedType,
            message: "Barchart symbol flow requires a valid session in the shared agent browser.",
          },
        );
      }
      lastFailure = response;
      continue;
    }
    sawSuccessfulResponse = true;

    const items = parseBarchartFlowItemsFromResponse(response, {
      symbol: normalizedSymbol,
      type: normalizedType,
      limit: maxItems,
    });
    if (!items) {
      continue;
    }

    return {
      ok: true,
      symbol: normalizedSymbol,
      type: normalizedType,
      sourceList: response.list || null,
      count: items.length,
      items,
    };
  }

  if (!sawSuccessfulResponse && lastFailure) {
    return createBarchartFlowFailure(
      {
        code: "http-error",
        status: lastFailure?.status ?? null,
        body: String(lastFailure?.text || lastFailure?.message || "").slice(0, 300),
      },
      {
        symbol: normalizedSymbol,
        type: normalizedType,
        message: "Barchart symbol flow requires a valid session in the shared agent browser.",
      },
    );
  }

  return {
    ok: true,
    symbol: normalizedSymbol,
    type: normalizedType,
    sourceList: null,
    count: 0,
    items: [],
  };
}
