import { evaluate, navigate } from "../../core/cdp.mjs";
import {
  connectBarchartPage,
  getBarchartPort,
  getQuoteUrl,
  getOptionsUrl,
  getTechnicalAnalysisUrl,
} from "./common.mjs";

function extractNumber(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return cleaned ? Number(cleaned[0]) : null;
}

export async function runBarchartTechnicals(flags) {
  const symbol = String(flags.symbol || "").trim().toUpperCase();
  if (!symbol) {
    throw new Error("Missing required --symbol");
  }

  const port = getBarchartPort(flags.port);
  const { client } = await connectBarchartPage(symbol, port);

  try {
    await navigate(client, getQuoteUrl(symbol), 4500);
    const overviewData = await evaluate(client, `
      (() => {
        const text = document.body.innerText || "";
        return {
          ivAtm: text.match(/Implied Volatility[\\s\\S]{0,40}?([0-9.]+%)/i)?.[1] || "",
          historicVolatility: text.match(/Historical Volatility[\\s\\S]{0,20}?([0-9.]+%)/i)?.[1] || "",
          ivPercentile: text.match(/IV Percentile[\\s\\S]{0,20}?([0-9.]+%)/i)?.[1] || "",
          ivRank: text.match(/IV Rank[\\s\\S]{0,20}?([0-9.]+%)/i)?.[1] || "",
          opinionLine: text.match(/\\b(Strong Buy|Buy|Hold|Sell|Strong Sell)\\b/i)?.[1] || "",
        };
      })()
    `);

    await navigate(client, getOptionsUrl(symbol), 4500);

    await navigate(client, getTechnicalAnalysisUrl(symbol), 4500);
    const technicalData = await evaluate(client, `
      (() => {
        const text = document.body.innerText || "";
        const lines = text.split("\\n").map((line) => line.trim()).filter(Boolean);
        const supportLine = lines.find((line) => /^Support\\s+/i.test(line)) || "";
        const resistanceLine = lines.find((line) => /^Resistance\\s+/i.test(line)) || "";
        const opinionLine = lines.find((line) => /^(Strong Buy|Buy|Hold|Sell|Strong Sell)\\s*$/i.test(line)) || "";

        const avgIndex = lines.findIndex((line) => line === "Period");
        const tableLines = avgIndex >= 0 ? lines.slice(avgIndex, avgIndex + 60) : [];
        const directionalIndex = lines.findIndex((line) => line.includes("Directional Index (ADX)"));
        const directionalLines = directionalIndex >= 0 ? lines.slice(directionalIndex, directionalIndex + 20) : [];

        return {
          supportLine,
          resistanceLine,
          opinionLine,
          tableLines,
          directionalLines,
          rawText: text.slice(0, 4000),
        };
      })()
    `);

    await navigate(client, `https://www.barchart.com/etfs-funds/quotes/${encodeURIComponent(symbol)}/cheat-sheet`, 4500);
    const cheatSheetData = await evaluate(client, `
      (() => {
        const text = document.body.innerText || "";
        const capture = (label) => text.match(new RegExp(label + '[\\\\s\\\\t]+([0-9]+(?:\\\\.[0-9]+)?)', 'i'))?.[1] || null;

        return {
          supportLevels: [
            capture('Pivot Point 1st Support Point'),
            capture('Pivot Point 2nd Support Point'),
            capture('Pivot Point 3rd Support Point'),
            capture('1-Month Low'),
            capture('13-Week Low'),
          ].filter(Boolean).map(Number),
          resistanceLevels: [
            capture('Pivot Point 1st Resistance Point'),
            capture('Pivot Point 2nd Level Resistance'),
            capture('Pivot Point 3rd Level Resistance'),
            capture('1-Month High'),
            capture('13-Week High'),
            capture('52-Week High'),
          ].filter(Boolean).map(Number),
        };
      })()
    `);

    const greeksData = await evaluate(client, `
      (async () => {
        const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
        const headers = csrf ? { 'X-CSRF-TOKEN': csrf } : {};
        const fields = [
          'strikePrice','lastPrice','volume','openInterest',
          'volatility','delta','gamma','theta','vega','rho',
          'expirationDate','optionType','percentFromLast'
        ].join(',');
        const url = '/proxies/core-api/v1/options/chain?symbol=' + encodeURIComponent(${JSON.stringify(symbol)}) + '&fields=' + fields + '&raw=1';
        const resp = await fetch(url, { credentials: 'include', headers });
        if (!resp.ok) return { items: [] };
        const json = await resp.json().catch(() => ({ data: [] }));
        const items = (json?.data || []).slice().sort((a, b) => Math.abs((a.raw || a).percentFromLast || 999) - Math.abs((b.raw || b).percentFromLast || 999));
        const call = items.find((item) => ((item.raw || item).optionType || '').toLowerCase() === 'call');
        return {
          callDelta: (call?.raw || call)?.delta ?? null,
          callGamma: (call?.raw || call)?.gamma ?? null,
        };
      })()
    `);

    process.stdout.write(`${JSON.stringify({
      ok: true,
      symbol,
      ivRank: extractNumber(overviewData.ivRank),
      ivPercentile: extractNumber(overviewData.ivPercentile),
      ivAtm: extractNumber(overviewData.ivAtm),
      historicVolatility: extractNumber(overviewData.historicVolatility),
      keyGreeks: {
        delta: greeksData.callDelta != null ? Number(Number(greeksData.callDelta).toFixed(4)) : null,
        gamma: greeksData.callGamma != null ? Number(Number(greeksData.callGamma).toFixed(4)) : null,
      },
      supportLevels: cheatSheetData.supportLevels || [],
      resistanceLevels: cheatSheetData.resistanceLevels || [],
      technicalRating: overviewData.opinionLine || technicalData.opinionLine || null,
      notes: (overviewData.opinionLine || technicalData.opinionLine)
        ? null
        : "Barchart public pages do not expose a compact buy/sell opinion label for this symbol in the current layout.",
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
