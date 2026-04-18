export function extractNumber(text) {
  if (!text) return null;
  const matched = String(text).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return matched ? Number(matched[0]) : null;
}

function getFieldByLabel(lines, label) {
  const idx = lines.findIndex((line) => line === label);
  return idx >= 0 ? (lines[idx + 1] || "") : "";
}

function getFieldByLabelFuzzy(lines, label) {
  // Exact match first
  const exact = getFieldByLabel(lines, label);
  if (exact) return exact;
  // Fuzzy: find line that starts with the label text (handles slight formatting changes)
  const lowerLabel = label.toLowerCase();
  const idx = lines.findIndex((line) => line.toLowerCase().startsWith(lowerLabel));
  return idx >= 0 ? (lines[idx + 1] || "") : "";
}

export function parseYahooFinanceQuoteDocument({ symbol, text, title = "", url = "" } = {}) {
  const normalizedSymbol = String(symbol || "").trim().toUpperCase();
  const bodyText = String(text || "");
  const lines = bodyText.split("\n").map((line) => line.trim()).filter(Boolean);

  const instrumentLine = lines.find((line) => line.includes(`(${normalizedSymbol})`)) || "";
  const priceIndex = lines.findIndex((line) => line === instrumentLine);

  // Primary parsing: label-based field extraction
  const rawResult = {
    ok: true,
    symbol: normalizedSymbol,
    title,
    url,
    instrument: instrumentLine,
    price: priceIndex >= 0 ? (lines[priceIndex + 1] || "") : "",
    change: priceIndex >= 0 ? (lines[priceIndex + 2] || "") : "",
    changePct: priceIndex >= 0 ? (lines[priceIndex + 3] || "") : "",
    previousClose: getFieldByLabelFuzzy(lines, "Previous Close"),
    open: getFieldByLabelFuzzy(lines, "Open"),
    bid: getFieldByLabelFuzzy(lines, "Bid"),
    ask: getFieldByLabelFuzzy(lines, "Ask"),
    dayRange: getFieldByLabelFuzzy(lines, "Day's Range"),
    weekRange: getFieldByLabelFuzzy(lines, "52 Week Range"),
    volume: getFieldByLabelFuzzy(lines, "Volume"),
    averageVolume: getFieldByLabelFuzzy(lines, "Avg. Volume"),
    netAssets: getFieldByLabelFuzzy(lines, "Net Assets"),
    peRatio: getFieldByLabelFuzzy(lines, "PE Ratio (TTM)"),
    yield: getFieldByLabelFuzzy(lines, "Yield"),
    beta: getFieldByLabelFuzzy(lines, "Beta (5Y Monthly)"),
    expenseRatio: getFieldByLabelFuzzy(lines, "Expense Ratio (net)"),
  };

  // Fallback: try regex-based extraction if label-based parsing yields no price
  if (!rawResult.price && bodyText.length > 100) {
    // Look for patterns like "$123.45" or "123.45 +1.23 (+0.94%)"
    const priceRe = /(?:^|\s)(\d{1,6}(?:\.\d{1,4})?)(?:\s+([+-]?\d+(?:\.\d+)?)\s+\(([+-]?\d+(?:\.\d+)?)%\))?/m;
    const priceMatch = bodyText.match(priceRe);
    if (priceMatch) {
      rawResult.price = priceMatch[1] || "";
      rawResult.change = priceMatch[2] || rawResult.change;
      rawResult.changePct = priceMatch[3] || rawResult.changePct;
    }
  }

  return {
    ...rawResult,
    price: extractNumber(rawResult.price),
    change: extractNumber(rawResult.change),
    changePct: extractNumber(rawResult.changePct),
    previousClose: extractNumber(rawResult.previousClose),
    open: extractNumber(rawResult.open),
    volume: extractNumber(rawResult.volume),
    averageVolume: extractNumber(rawResult.averageVolume),
    netAssets: rawResult.netAssets || "",
    peRatio: extractNumber(rawResult.peRatio),
    beta: extractNumber(rawResult.beta),
  };
}