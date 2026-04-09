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

function toBarchartFlowItem(row) {
  const normalized = row?.raw || row || {};
  return {
    symbol: normalized.baseSymbol || normalized.symbol || "",
    type: normalized.optionType || "",
    strike: round(normalized.strikePrice),
    expiration: normalized.expirationDate || "",
    last: round(normalized.lastPrice),
    volume: normalized.volume ?? null,
    openInterest: normalized.openInterest ?? null,
    volOiRatio: round(normalized.volumeOpenInterestRatio),
    iv: round(normalized.volatility),
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

    let json;
    try {
      json = JSON.parse(String(response.text || ""));
    } catch {
      continue;
    }

    const rows = Array.isArray(json?.data) ? json.data : [];
    if (rows.length === 0) {
      continue;
    }

    const filteredRows = filterBarchartFlowRows(rows, { type: normalizedType });
    if (filteredRows.length === 0) {
      continue;
    }

    const items = filteredRows.slice(0, maxItems).map(toBarchartFlowItem);
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

  if (!result.response?.ok) {
    const code = result.response?.status === 401 || result.response?.status === 403 ? "needs-login" : "http-error";
    return createBarchartFlowFailure(
      {
        code,
        status: result.response?.status ?? null,
        body: String(result.response?.text || "").slice(0, 300),
      },
      {
        symbol: normalizedSymbol,
        type: normalizedType,
        message: "Barchart symbol flow requires a valid session in the shared agent browser.",
      },
    );
  }

  let json;
  try {
    json = JSON.parse(String(result.response?.text || ""));
  } catch (error) {
    return createBarchartFlowFailure(
      {
        code: "request-failed",
        message: String(error),
      },
      {
        symbol: normalizedSymbol,
        type: normalizedType,
        message: "Barchart symbol flow requires a valid session in the shared agent browser.",
      },
    );
  }

  const rows = Array.isArray(json?.data) ? json.data : [];
  const items = filterBarchartFlowRows(rows, {
    symbol: normalizedSymbol,
    type: normalizedType,
  })
    .slice(0, maxItems)
    .map(toBarchartFlowItem);

  return {
    ok: true,
    symbol: normalizedSymbol,
    type: normalizedType,
    count: items.length,
    items,
  };
}