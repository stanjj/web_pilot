import { evaluate, navigate } from "../../core/cdp.mjs";
import {
  connectWhaleStreamPage,
  getWhaleStreamPort,
  getWhaleStreamTopDarkPoolUrl,
  getWhaleStreamTopOptionsUrl,
} from "./common.mjs";

async function extractTopOptions(client, limit) {
  await navigate(client, getWhaleStreamTopOptionsUrl(), 4500);
  return evaluate(client, `
    (() => {
      const count = ${Math.max(1, Math.min(limit, 20))};
      const cards = [...document.querySelectorAll('a[href*="/market-tracker/"]')]
        .map((anchor) => {
          const ticker = anchor.textContent?.trim() || "";
          if (!/^[A-Z]{1,5}$/.test(ticker)) return null;
          const card = anchor.parentElement?.parentElement?.parentElement;
          const text = card?.innerText?.replace(/\\s+/g, ' ').trim() || '';
          return {
            ticker,
            url: anchor.href || "",
            text,
            orders: text.match(/(\\d+)\\s+Orders/i)?.[1] || "",
            contracts: text.match(/([0-9,.]+)\\s+Contracts/i)?.[1] || "",
            premium: [...text.matchAll(/\\$[0-9,.]+(?:[KMB])?/g)].map((m) => m[0]).at(-1) || "",
          };
        })
        .filter(Boolean)
        .filter((item, index, list) => list.findIndex((entry) => entry.ticker === item.ticker && entry.premium === item.premium) === index)
        .slice(0, count);

      const heading = document.querySelector("h1")?.textContent?.trim() || document.title;
      const sessionStatus = [...document.querySelectorAll("p")].map((p) => p.textContent?.trim() || "").find((t) => /Market Closed|Market Open|Next session/i.test(t)) || "";

      return { heading, sessionStatus, items: cards };
    })()
  `);
}

async function extractTopDarkPool(client, limit) {
  await navigate(client, getWhaleStreamTopDarkPoolUrl(), 4500);
  return evaluate(client, `
    (() => {
      const count = ${Math.max(1, Math.min(limit, 20))};
      const items = [...document.querySelectorAll('a[href*="/market-tracker/"]')]
        .map((anchor) => {
          const ticker = anchor.textContent?.trim() || "";
          if (!/^[A-Z]{1,5}$/.test(ticker)) return null;
          const card = anchor.parentElement?.parentElement?.parentElement;
          const text = card?.innerText?.replace(/\\s+/g, ' ').trim() || '';
          const badge = card.querySelector('button')?.textContent?.trim() || "";
          return {
            ticker,
            url: anchor.href || "",
            flowType: badge,
            orders: text.match(/(\\d+)\\s+Orders/i)?.[1] || "",
            shares: text.match(/([0-9,.]+[MK]?)\\s+Shares/i)?.[1] || "",
            size: [...text.matchAll(/\\$[0-9,.]+(?:[KMB])?/g)].map((m) => m[0]).at(-1) || "",
            text,
          };
        })
        .filter(Boolean)
        .slice(0, count);

      const heading = document.querySelector("h1")?.textContent?.trim() || document.title;
      const sessionStatus = [...document.querySelectorAll("p")].map((p) => p.textContent?.trim() || "").find((t) => /Market Closed|Market Open|Next session/i.test(t)) || "";

      return { heading, sessionStatus, items };
    })()
  `);
}

export async function fetchWhaleStreamSummary(flags) {
  const limit = Math.min(Number(flags.limit ?? 10), 20);
  const port = getWhaleStreamPort(flags.port);
  const { client } = await connectWhaleStreamPage(port);

  try {
    const topOptionsFlow = await extractTopOptions(client, limit);
    const topDarkPoolTickers = await extractTopDarkPool(client, limit);

    return {
      ok: true,
      dailySummary: {
        optionsHeading: topOptionsFlow.heading,
        darkPoolHeading: topDarkPoolTickers.heading,
        sessionStatus: topOptionsFlow.sessionStatus || topDarkPoolTickers.sessionStatus || null,
      },
      topOptionsFlow: topOptionsFlow.items || [],
      topDarkPoolTickers: topDarkPoolTickers.items || [],
    };
  } finally {
    await client.close();
  }
}

export async function runWhaleStreamSummary(flags) {
  const result = await fetchWhaleStreamSummary(flags);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}

/**
 * Normalize whalestream summary fetch result to the shared flow trade schema.
 * Whalestream topOptionsFlow items lack side/strike/expiry — those fields are null.
 * @param {object|null} data  Return value of fetchWhaleStreamSummary()
 * @returns {Array<{ ticker, side, sentiment, premiumValue, premium, strike, expiry, size, source }>}
 */
export function toFlowTrades(data) {
  if (!data?.ok || !Array.isArray(data.topOptionsFlow)) return [];
  return data.topOptionsFlow.map((item) => ({
    ticker: item.ticker ?? null,
    side: null,
    sentiment: null,
    premiumValue: null,
    premium: item.premium ?? null,
    strike: null,
    expiry: null,
    size: null,
    source: "whalestream",
  }));
}
