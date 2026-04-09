import { evaluate, navigate } from "../../core/cdp.mjs";
import {
  connectYahooFinancePage,
  getEarningsUrl,
  getQuoteUrl,
  getYahooFinancePort,
} from "./common.mjs";

function extractNumber(text) {
  if (!text) return null;
  const matched = String(text).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return matched ? Number(matched[0]) : null;
}

export async function fetchYahooFinanceCatalyst(flags) {
  const symbol = String(flags.symbol || "").trim().toUpperCase();
  const limit = Math.min(Number(flags.limit ?? 5), 10);
  if (!symbol) {
    throw new Error("Missing required --symbol");
  }

  const port = getYahooFinancePort(flags.port);
  const { client } = await connectYahooFinancePage(symbol, port);

  try {
    await navigate(client, getQuoteUrl(symbol), 5000);
    const result = await evaluate(client, `
      (() => {
        const text = document.body.innerText || '';
        const lines = text.split('\\n').map((line) => line.trim()).filter(Boolean);
        const getField = (label) => {
          const idx = lines.findIndex((line) => line === label);
          return idx >= 0 ? (lines[idx + 1] || '') : '';
        };

        const headlines = [...document.querySelectorAll('a[href*="qsp-recent-news_"]')]
          .map((anchor) => {
            const title = (anchor.textContent || '').replace(/\\s+/g, ' ').trim();
            const block = anchor.parentElement?.parentElement?.innerText?.replace(/\\s+/g, ' ').trim()
              || anchor.parentElement?.innerText?.replace(/\\s+/g, ' ').trim()
              || '';
            if (!title || title === 'View More') return null;
            const meta = block.replace(title, '').trim();
            const parts = meta.split(/\\s+[•·]\\s+/).map((part) => part.trim()).filter(Boolean);
            return {
              title,
              source: parts[0] || '',
              time: parts[1] || '',
            };
          })
          .filter(Boolean)
          .filter((item, index, list) => list.findIndex((entry) => entry.title === item.title) === index)
          .slice(0, ${Math.max(1, Math.min(limit, 10))});

        const scoutSummaryIndex = lines.findIndex((line) => line === 'News headlines');
        const scoutSummary = scoutSummaryIndex >= 0 ? (lines[scoutSummaryIndex + 1] || '') : '';

        return {
          ok: true,
          symbol: ${JSON.stringify(symbol)},
          title: document.title,
          url: location.href,
          marketCap: getField('Market Cap (intraday)') || getField('Net Assets'),
          peRatio: getField('PE Ratio (TTM)'),
          analystRating: getField('Average Recommendation') || getField('Analyst Rating') || null,
          upcomingEarningsDate: getField('Earnings Date (est.)') || getField('Earnings Date'),
          scoutSummary,
          recentNewsHeadlines: headlines,
        };
      })()
    `);

    await navigate(client, getEarningsUrl(symbol), 1500);

    return {
      ok: true,
      symbol,
      upcomingEarningsDate: result.upcomingEarningsDate || null,
      recentNewsHeadlines: result.recentNewsHeadlines || [],
      scoutSummary: result.scoutSummary || null,
      marketCap: result.marketCap || null,
      peRatio: extractNumber(result.peRatio),
      analystRating: result.analystRating || null,
    };
  } finally {
    await client.close();
  }
}

export async function runYahooFinanceCatalyst(flags) {
  const result = await fetchYahooFinanceCatalyst(flags);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}
