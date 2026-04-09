function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractNumber(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return cleaned ? Number(cleaned[0]) : null;
}

export function parseBarchartQuoteDocument({ symbol, text, title = "", url = "" } = {}) {
  const normalizedSymbol = String(symbol || "").trim().toUpperCase();
  const bodyText = String(text || "");
  const lines = bodyText.split("\n").map((line) => line.trim());
  const getField = (label) => {
    const idx = lines.findIndex((line) => line === label);
    return idx >= 0 ? (lines[idx + 1] || "") : "";
  };
  const symbolPattern = escapeRegExp(normalizedSymbol);
  const instrument = bodyText.match(new RegExp(`([^\\n]+) \\(${symbolPattern}\\)`))?.[1] || "";
  const quoteLine = bodyText.match(new RegExp(`${symbolPattern}\\)\\n([^\\n]+)`))?.[1] || "";
  const openInline = bodyText.match(/Open\s+([^\n]+)/)?.[1] || "";

  const result = {
    ok: true,
    symbol: normalizedSymbol,
    title,
    url,
    instrument,
    priceLine: quoteLine || "",
    price: (quoteLine || "").match(/-?\d[\d,.]*(?:\.\d+)?/)?.[0] || "",
    dayLow: getField("Day Low"),
    dayHigh: getField("Day High"),
    open: getField("Open") || openInline,
    previousClose: getField("Previous Close"),
    volume: getField("Volume"),
    averageVolume: getField("Average Volume"),
    rawHeader: "",
  };

  return {
    ...result,
    price: extractNumber(result.price || result.rawHeader),
    dayLow: extractNumber(result.dayLow),
    dayHigh: extractNumber(result.dayHigh),
    open: extractNumber(result.open),
    previousClose: extractNumber(result.previousClose),
    volume: extractNumber(result.volume),
    averageVolume: extractNumber(result.averageVolume),
  };
}