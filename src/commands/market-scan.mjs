import { runInsiderFinanceFlow } from "../sites/insiderfinance/flow.mjs";
import { runMarketBeatUnusualVolume } from "../sites/marketbeat/unusual-volume.mjs";
import { runPineifyLiveFlow } from "../sites/pineify/live-flow.mjs";
import { runUnusualWhalesFlow } from "../sites/unusual-whales/flow.mjs";
import { runWhaleStreamSummary } from "../sites/whalestream/summary.mjs";

function parseNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeSymbols(raw) {
  const values = String(raw || "SPY,QQQ,IWM,AAPL,NVDA,TSLA")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  return [...new Set(values)];
}

async function captureJsonOutput(run) {
  const originalWrite = process.stdout.write.bind(process.stdout);
  let buffer = "";

  process.stdout.write = (chunk, encoding, callback) => {
    buffer += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString(typeof encoding === "string" ? encoding : "utf8");
    if (typeof callback === "function") callback();
    return true;
  };

  try {
    await run();
  } finally {
    process.stdout.write = originalWrite;
  }

  const text = buffer.trim();
  if (!text) {
    throw new Error("Empty stdout");
  }
  return JSON.parse(text);
}

function ensureTicker(bucket, ticker) {
  if (!bucket.has(ticker)) {
    bucket.set(ticker, {
      ticker,
      score: 0,
      bullishSignals: 0,
      bearishSignals: 0,
      activitySignals: 0,
      totalPremium: 0,
      totalSize: 0,
      sources: [],
    });
  }
  return bucket.get(ticker);
}

function pushSource(entry, source, payload) {
  entry.sources.push({ source, ...payload });
}

function finalizeDirection(entry) {
  if (entry.score >= 3) return "bullish";
  if (entry.score <= -3) return "bearish";
  if (entry.bullishSignals > entry.bearishSignals) return "slightly_bullish";
  if (entry.bearishSignals > entry.bullishSignals) return "slightly_bearish";
  return "mixed";
}

function isConflicted(entry) {
  return entry.bullishSignals > 0 && entry.bearishSignals > 0;
}

export async function runMarketScan(flags) {
  const port = String(flags.port ?? 9223);
  const limit = Math.max(1, Math.min(Number(flags.limit ?? 10), 20));
  const symbols = normalizeSymbols(flags.symbols);
  const tickerSet = new Set(symbols);
  const onlyWatched = !String(flags.all || "").trim();
  const tickers = new Map();
  const errors = [];

  const commands = [
    {
      name: "pineify",
      run: () => captureJsonOutput(() => runPineifyLiveFlow({
        symbols: symbols.join(","),
        "min-volume-ratio": "2",
        limit: String(limit),
        port,
      })),
      handle(result) {
        for (const item of result.items || []) {
          const ticker = String(item.ticker || "").toUpperCase();
          if (!ticker) continue;
          const entry = ensureTicker(tickers, ticker);
          const premiumValue = parseNumber(item.premiumValue) || 0;
          const bullish = String(item.sentiment || "").toLowerCase().includes("bull");
          const bearish = String(item.sentiment || "").toLowerCase().includes("bear");
          entry.totalPremium += premiumValue;
          entry.activitySignals += 1;
          if (bullish) {
            entry.score += 2;
            entry.bullishSignals += 1;
          }
          if (bearish) {
            entry.score -= 2;
            entry.bearishSignals += 1;
          }
          pushSource(entry, "pineify", {
            contract: item.contract,
            sentiment: item.sentiment,
            volumeRatio: item.volumeRatio,
            premium: item.premium,
            largeOrder: item.largeOrder,
          });
        }
      },
    },
    {
      name: "insiderfinance",
      run: () => captureJsonOutput(() => runInsiderFinanceFlow({
        limit: String(limit),
        "min-size": "1000000",
        port,
      })),
      handle(result) {
        for (const item of result.items || []) {
          const ticker = String(item.ticker || "").toUpperCase();
          if (!ticker || (onlyWatched && !tickerSet.has(ticker))) continue;
          const entry = ensureTicker(tickers, ticker);
          const sizeValue = parseNumber(item.sizeValue) || 0;
          const direction = String(item.smartMoneyDirection || "").toLowerCase();
          entry.totalSize += sizeValue;
          entry.activitySignals += 1;
          if (direction.includes("bull")) {
            entry.score += 3;
            entry.bullishSignals += 1;
          } else if (direction.includes("bear")) {
            entry.score -= 3;
            entry.bearishSignals += 1;
          }
          pushSource(entry, "insiderfinance", {
            flowType: item.flowType,
            direction: item.smartMoneyDirection,
            contractType: item.contractType,
            size: item.size,
            expiry: item.expiry,
            strike: item.strike,
          });
        }
      },
    },
    {
      name: "unusual-whales",
      run: () => captureJsonOutput(() => runUnusualWhalesFlow({
        limit: String(limit),
        "min-premium": "500000",
        port,
      })),
      handle(result) {
        for (const item of result.items || []) {
          const ticker = String(item.ticker || "").toUpperCase();
          if (!ticker || (onlyWatched && !tickerSet.has(ticker))) continue;
          const entry = ensureTicker(tickers, ticker);
          const premiumValue = parseNumber(item.premiumValue) || 0;
          const sentiment = String(item.sentiment || "").toLowerCase();
          entry.totalPremium += premiumValue;
          entry.activitySignals += 1;
          if (sentiment.includes("bull")) {
            entry.score += 2;
            entry.bullishSignals += 1;
          } else if (sentiment.includes("bear")) {
            entry.score -= 2;
            entry.bearishSignals += 1;
          }
          pushSource(entry, "unusual-whales", {
            sentiment: item.sentiment,
            premium: item.premium,
            expiry: item.expiry,
            strike: item.strike,
            side: item.side,
          });
        }
      },
    },
    {
      name: "marketbeat-call",
      run: () => captureJsonOutput(() => runMarketBeatUnusualVolume({
        limit: String(limit),
        "min-change": "200",
        port,
      }, "call")),
      handle(result) {
        for (const item of result.items || []) {
          const ticker = String(item.ticker || "").toUpperCase();
          if (!ticker || (onlyWatched && !tickerSet.has(ticker))) continue;
          const entry = ensureTicker(tickers, ticker);
          entry.score += 1;
          entry.bullishSignals += 1;
          entry.activitySignals += 1;
          pushSource(entry, "marketbeat-call", {
            volumeChange: item.volumeChange,
            price: item.price,
            volume: item.volume,
            avgVolume: item.avgVolume,
          });
        }
      },
    },
    {
      name: "marketbeat-put",
      run: () => captureJsonOutput(() => runMarketBeatUnusualVolume({
        limit: String(limit),
        "min-change": "200",
        port,
      }, "put")),
      handle(result) {
        for (const item of result.items || []) {
          const ticker = String(item.ticker || "").toUpperCase();
          if (!ticker || (onlyWatched && !tickerSet.has(ticker))) continue;
          const entry = ensureTicker(tickers, ticker);
          entry.score -= 1;
          entry.bearishSignals += 1;
          entry.activitySignals += 1;
          pushSource(entry, "marketbeat-put", {
            volumeChange: item.volumeChange,
            price: item.price,
            volume: item.volume,
            avgVolume: item.avgVolume,
          });
        }
      },
    },
    {
      name: "whalestream",
      run: () => captureJsonOutput(() => runWhaleStreamSummary({
        limit: String(limit),
        port,
      })),
      handle(result) {
        for (const item of result.topOptionsFlow || []) {
          const ticker = String(item.ticker || "").toUpperCase();
          if (!ticker || (onlyWatched && !tickerSet.has(ticker))) continue;
          const entry = ensureTicker(tickers, ticker);
          entry.activitySignals += 1;
          pushSource(entry, "whalestream-options", {
            premium: item.premium,
            orders: item.orders,
            contracts: item.contracts,
          });
        }
        for (const item of result.topDarkPoolTickers || []) {
          const ticker = String(item.ticker || "").toUpperCase();
          if (!ticker || (onlyWatched && !tickerSet.has(ticker))) continue;
          const entry = ensureTicker(tickers, ticker);
          entry.activitySignals += 1;
          pushSource(entry, "whalestream-darkpool", {
            size: item.size,
            flowType: item.flowType,
            shares: item.shares,
          });
        }
      },
    },
  ];

  for (const command of commands) {
    try {
      const result = await command.run();
      command.handle(result);
    } catch (error) {
      errors.push({
        source: command.name,
        error: error?.message || String(error),
      });
    }
  }

  const summaryItems = [...tickers.values()]
    .map((entry) => ({
      ticker: entry.ticker,
      direction: finalizeDirection(entry),
      conflicted: isConflicted(entry),
      score: entry.score,
      bullishSignals: entry.bullishSignals,
      bearishSignals: entry.bearishSignals,
      activitySignals: entry.activitySignals,
      totalPremiumValue: Math.round(entry.totalPremium),
      totalSizeValue: Math.round(entry.totalSize),
      sources: entry.sources,
    }))
    .sort((a, b) => {
      const scoreDiff = Math.abs(b.score) - Math.abs(a.score);
      if (scoreDiff !== 0) return scoreDiff;
      const activityDiff = b.activitySignals - a.activitySignals;
      if (activityDiff !== 0) return activityDiff;
      return (b.totalPremiumValue + b.totalSizeValue) - (a.totalPremiumValue + a.totalSizeValue);
    });

  const headlines = {
    bullish: summaryItems.filter((item) => item.direction === "bullish" || item.direction === "slightly_bullish").slice(0, 5),
    bearish: summaryItems.filter((item) => item.direction === "bearish" || item.direction === "slightly_bearish").slice(0, 5),
    mixed: summaryItems.filter((item) => item.direction === "mixed").slice(0, 5),
  };

  process.stdout.write(`${JSON.stringify({
    ok: true,
    symbols,
    onlyWatched,
    count: summaryItems.length,
    headlines,
    items: summaryItems,
    errors,
  }, null, 2)}\n`);
}
