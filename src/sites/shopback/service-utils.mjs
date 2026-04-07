export function parseCashbackValue(text) {
  const raw = String(text || "").trim();
  if (!raw) return { raw, kind: "unknown", value: null };

  const percentMatch = raw.match(/(\d+(?:\.\d+)?)%\s*Cashback/i);
  if (percentMatch) {
    return {
      raw,
      kind: "percent",
      value: Number(percentMatch[1]),
    };
  }

  const dollarMatch = raw.match(/\$([0-9]+(?:\.[0-9]+)?)\s*Cashback/i);
  if (dollarMatch) {
    return {
      raw,
      kind: "dollar",
      value: Number(dollarMatch[1]),
    };
  }

  return { raw, kind: "unknown", value: null };
}

export function sortByCashback(items = [], mode = "auto") {
  return [...items].sort((a, b) => {
    const av = parseCashbackValue(a.cashback);
    const bv = parseCashbackValue(b.cashback);

    if (mode === "percent-only") {
      if (av.kind !== bv.kind) {
        if (av.kind === "percent") return -1;
        if (bv.kind === "percent") return 1;
      }
    } else if (mode === "dollar-only") {
      if (av.kind !== bv.kind) {
        if (av.kind === "dollar") return -1;
        if (bv.kind === "dollar") return 1;
      }
    } else {
      if (av.kind !== bv.kind) {
        if (av.kind === "percent") return -1;
        if (bv.kind === "percent") return 1;
        if (av.kind === "dollar") return -1;
        if (bv.kind === "dollar") return 1;
      }
    }

    const valueDiff = (bv.value ?? -1) - (av.value ?? -1);
    if (valueDiff !== 0) return valueDiff;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

export function filterServices(items = [], terms = []) {
  return items.filter((item) => {
    const text = `${item.name} ${item.cashback}`.toLowerCase();
    return terms.some((term) => text.includes(term));
  });
}

export function normalizeSortedItems(items = [], mode = "auto") {
  return sortByCashback(items, mode).map((item) => ({
    ...item,
    normalized: parseCashbackValue(item.cashback),
  }));
}
