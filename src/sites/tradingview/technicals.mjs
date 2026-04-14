import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectTradingViewPage, getTradingViewPort, getTradingViewSymbolUrl } from "./common.mjs";

export function normalizeTradingViewTechnicals(snapshot) {
  const summary = String(snapshot?.summary || "").toLowerCase();
  const trend = summary.includes("buy") ? "up" : summary.includes("sell") ? "down" : "sideways";
  return {
    trend,
    rsi: snapshot?.rsi ?? null,
    signals: [snapshot?.summary, snapshot?.oscillators, snapshot?.movingAverages].filter(Boolean),
    source: "tradingview",
  };
}

export async function fetchTradingViewTechnicals(flags) {
  const symbol = String(flags.symbol || "").trim();
  if (!symbol) throw new Error("Missing required --symbol");
  const exchange = String(flags.exchange || "").trim();
  const port = getTradingViewPort(flags.port);
  const { client } = await connectTradingViewPage(port);

  try {
    await navigate(client, getTradingViewSymbolUrl(symbol, exchange), 5000);
    const snapshot = await evaluate(client, `
      (() => ({
        summary: document.body.innerText.match(/Summary\\s+(Strong Sell|Sell|Neutral|Buy|Strong Buy)/i)?.[1] || "",
        oscillators: document.body.innerText.match(/Oscillators\\s+(Strong Sell|Sell|Neutral|Buy|Strong Buy)/i)?.[1] || "",
        movingAverages: document.body.innerText.match(/Moving Averages\\s+(Strong Sell|Sell|Neutral|Buy|Strong Buy)/i)?.[1] || "",
      }))()
    `);
    return { ok: true, symbol: symbol.toUpperCase(), technicals: normalizeTradingViewTechnicals(snapshot) };
  } finally {
    await client.close();
  }
}

export async function runTradingViewTechnicals(flags) {
  const result = await fetchTradingViewTechnicals(flags);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}
