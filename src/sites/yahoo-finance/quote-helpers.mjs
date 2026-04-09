export function extractNumber(text) {
  if (!text) return null;
  const matched = String(text).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return matched ? Number(matched[0]) : null;
}

export function parseYahooFinanceQuoteDocument({ symbol, text, title = "", url = "" } = {}) {
  const normalizedSymbol = String(symbol || "").trim().toUpperCase();
  const bodyText = String(text || "");
  const lines = bodyText.split("\n").map((line) => line.trim()).filter(Boolean);
  const getField = (label) => {
    const idx = lines.findIndex((line) => line === label);
    return idx >= 0 ? (lines[idx + 1] || "") : "";
  };

  const instrumentLine = lines.find((line) => line.includes(`(${normalizedSymbol})`)) || "";
  const priceIndex = lines.findIndex((line) => line === instrumentLine);
  const result = {
    ok: true,
    symbol: normalizedSymbol,
    title,
    url,
    instrument: instrumentLine,
    price: priceIndex >= 0 ? (lines[priceIndex + 1] || "") : "",
    change: priceIndex >= 0 ? (lines[priceIndex + 2] || "") : "",
    changePct: priceIndex >= 0 ? (lines[priceIndex + 3] || "") : "",
    previousClose: getField("Previous Close"),
    open: getField("Open"),
    bid: getField("Bid"),
    ask: getField("Ask"),
    dayRange: getField("Day's Range"),
    weekRange: getField("52 Week Range"),
    volume: getField("Volume"),
    averageVolume: getField("Avg. Volume"),
    netAssets: getField("Net Assets"),
    peRatio: getField("PE Ratio (TTM)"),
    yield: getField("Yield"),
    beta: getField("Beta (5Y Monthly)"),
    expenseRatio: getField("Expense Ratio (net)"),
  };

  return {
    ...result,
    price: extractNumber(result.price),
    change: extractNumber(result.change),
    changePct: extractNumber(result.changePct),
    previousClose: extractNumber(result.previousClose),
    open: extractNumber(result.open),
    volume: extractNumber(result.volume),
    averageVolume: extractNumber(result.averageVolume),
    netAssets: result.netAssets || "",
    peRatio: extractNumber(result.peRatio),
    beta: extractNumber(result.beta),
  };
}