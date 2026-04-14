import { aggregate } from "../../core/market-aggregator.mjs";
import { fetchXueqiuSymbolSentiment } from "../xueqiu/symbol-sentiment.mjs";
import { runWeiboSearch } from "../weibo/search.mjs";
import { runZhihuSearch } from "../zhihu/search.mjs";
import { runRedditSearch } from "../reddit/search.mjs";

/**
 * Merge sentiment results from multiple sources into the unified sentiment schema.
 * @param {Array<{ name: string, data: unknown }>} succeeded
 * @param {string} symbol
 * @returns {{ score: number, hot_rank: unknown, mentions: number, sources: string[] }}
 */
export function mergeSentimentResults(succeeded, symbol) {
  let mentions = 0;
  let hotRank = null;
  const sources = [];

  for (const { name, data } of succeeded) {
    if (!data?.ok) continue;
    sources.push(name);

    if (name === "xueqiu") {
      mentions += Number(data.discussions ?? 0);
      hotRank = data.hotRank ?? hotRank;
      continue;
    }

    mentions += Number(data.count ?? 0);
  }

  // Score: without NLP, default to 0 (neutral). Agents can apply LLM for scoring.
  const score = 0;

  return { score, hot_rank: hotRank, mentions, sources };
}

export async function fetchMarketSentiment(flags) {
  const symbol = String(flags.symbol || "").trim().toUpperCase();
  if (!symbol) throw new Error("Missing required --symbol");
  const timeoutMs = flags.quick ? 4000 : 0;
  const port = flags.port;

  const { data: sentiment, meta } = await aggregate({
    sources: [
      { name: "xueqiu", fetch: () => fetchXueqiuSymbolSentiment({ symbol, port }) },
      { name: "weibo", fetch: () => runWeiboSearch({ query: symbol, port, limit: 20 }) },
      { name: "zhihu", fetch: () => runZhihuSearch({ keyword: symbol, port, limit: 20 }) },
      { name: "reddit", fetch: () => runRedditSearch({ query: symbol, port, limit: 20 }) },
    ],
    timeoutMs,
    merge: (succeeded) => mergeSentimentResults(succeeded, symbol),
  });

  return {
    ok: true,
    symbol,
    sentiment,
    meta: { ...meta, command: "market sentiment" },
  };
}

export async function runMarketSentiment(flags) {
  const result = await fetchMarketSentiment(flags);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}
