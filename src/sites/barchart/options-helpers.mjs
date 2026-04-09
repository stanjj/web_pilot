function round(value, digits = 2) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Number(Number(value).toFixed(digits));
}

export function classifyMoneyness(strike, underlyingPrice, optionType) {
  if (strike == null || underlyingPrice == null || !underlyingPrice) return null;
  const diff = (strike - underlyingPrice) / underlyingPrice;
  if (Math.abs(diff) <= 0.01) return "atm";
  const type = String(optionType || "").toLowerCase();
  if (type === "call") return diff < 0 ? "itm" : "otm";
  if (type === "put") return diff > 0 ? "itm" : "otm";
  return null;
}

export function parseBarchartOptionsResponse({
  symbol,
  type,
  limit,
  expiration,
  strikeMin,
  strikeMax,
  moneyness,
  status,
  ok,
  text,
} = {}) {
  const maxItems = Number.isFinite(limit) ? Math.max(1, limit) : 20;

  if (!ok) {
    const needsLogin = status === 401 || status === 403;
    return {
      ok: false,
      symbol,
      type,
      needsLogin,
      status: status ?? null,
      message: needsLogin
        ? "Barchart options chain requires a logged-in session in the shared agent browser."
        : "Barchart options request failed.",
      body: String(text || "").slice(0, 300),
    };
  }

  let json;
  try {
    json = JSON.parse(String(text || ""));
  } catch {
    return {
      ok: false,
      symbol,
      type,
      needsLogin: false,
      status: status ?? null,
      message: "Barchart options request failed.",
      body: String(text || "").slice(0, 300),
    };
  }

  let items = Array.isArray(json?.data) ? json.data : [];

  items = items.filter((item) => {
    const optionType = (item?.raw || item)?.optionType || "";
    return optionType.toLowerCase() === String(type || "").toLowerCase();
  });

  if (expiration) {
    items = items.filter((item) => {
      const exp = (item?.raw || item)?.expirationDate || "";
      return exp === expiration;
    });
  }

  if (Number.isFinite(strikeMin)) {
    items = items.filter((item) => {
      const strike = Number((item?.raw || item)?.strikePrice);
      return Number.isFinite(strike) && strike >= strikeMin;
    });
  }
  if (Number.isFinite(strikeMax)) {
    items = items.filter((item) => {
      const strike = Number((item?.raw || item)?.strikePrice);
      return Number.isFinite(strike) && strike <= strikeMax;
    });
  }

  items.sort((left, right) => {
    const leftDistance = Math.abs((left?.raw || left)?.percentFromLast || 999);
    const rightDistance = Math.abs((right?.raw || right)?.percentFromLast || 999);
    return leftDistance - rightDistance;
  });

  const underlyingPriceFromPercentFromLast = (() => {
    const firstItem = items[0]?.raw || items[0];
    if (!firstItem) return null;
    const strike = Number(firstItem.strikePrice);
    const pct = Number(firstItem.percentFromLast);
    if (!Number.isFinite(strike) || !Number.isFinite(pct) || pct === 0) return null;
    return strike / (1 + pct / 100);
  })();

  const mappedItems = items.map((item) => {
    const row = item?.raw || item;
    const strike = Number(row?.strikePrice) || null;
    const derivedMoneyness = classifyMoneyness(strike, underlyingPriceFromPercentFromLast, row?.optionType);
    return {
      strike: round(row?.strikePrice),
      bid: round(row?.bidPrice),
      ask: round(row?.askPrice),
      last: round(row?.lastPrice),
      change: round(row?.priceChange),
      volume: row?.volume ?? null,
      openInterest: row?.openInterest ?? null,
      iv: round(row?.volatility),
      delta: round(row?.delta, 4),
      gamma: round(row?.gamma, 4),
      theta: round(row?.theta, 4),
      vega: round(row?.vega, 4),
      expiration: row?.expirationDate || "",
      optionType: row?.optionType || "",
      moneyness: derivedMoneyness,
    };
  });

  const filteredItems = moneyness
    ? mappedItems.filter((item) => item.moneyness === moneyness)
    : mappedItems;

  return {
    ok: true,
    symbol,
    type,
    requestedExpiration: expiration ?? null,
    count: filteredItems.length,
    items: filteredItems.slice(0, maxItems),
  };
}