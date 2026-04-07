import { evaluate, navigate } from "../../core/cdp.mjs";
import {
  connectMarketBeatPage,
  getMarketBeatPort,
  getMarketBeatUnusualCallUrl,
  getMarketBeatUnusualPutUrl,
} from "./common.mjs";

function parsePercent(value) {
  const match = String(value || "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function splitTickerAndCompany(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^([A-Z.-]{1,10})(.*)$/);
  if (!match) {
    return { ticker: raw, company: "" };
  }
  return {
    ticker: match[1].trim(),
    company: match[2].trim(),
  };
}

export async function runMarketBeatUnusualVolume(flags, side = "call") {
  const limit = Math.min(Number(flags.limit ?? 20), 50);
  const minChange = Number(flags["min-change"] ?? 200);
  const port = getMarketBeatPort(flags.port);
  const url = side === "put" ? getMarketBeatUnusualPutUrl() : getMarketBeatUnusualCallUrl();
  const { client } = await connectMarketBeatPage(port);

  try {
    await navigate(client, url, 4500);

    const result = await evaluate(client, `
      (() => {
        const count = ${Number.isFinite(limit) ? Math.max(1, limit) : 20};
        const rows = [...document.querySelectorAll("table tbody tr")]
          .map((row) => {
            const cells = [...row.querySelectorAll("td")].map((cell) => (cell.textContent || "").replace(/\\s+/g, " ").trim());
            const tickerLink = row.querySelector('a[href*="/stocks/"]');
            const company = cells[1] || "";

            return {
              ticker: cells[0] || tickerLink?.textContent?.trim() || "",
              company,
              price: cells[1] || "",
              volume: cells[2] || "",
              avgVolume: cells[3] || "",
              volumeChange: cells[4] || "",
              stockVolume: cells[5] || "",
              tags: cells[6] || "",
              url: tickerLink?.href || "",
            };
          })
          .filter((item) => item.ticker && item.volumeChange)
          .slice(0, count * 3);

        return {
          ok: true,
          pageTitle: document.title,
          pageUrl: location.href,
          items: rows,
        };
      })()
    `);

    const items = (result.items || [])
      .map((item, index) => {
        const parsed = splitTickerAndCompany(item.ticker);
        const urlTicker = String(item.url || "").match(/\/stocks\/[^/]+\/([^/]+)\//i)?.[1] || "";
        const company = urlTicker && String(item.ticker || "").startsWith(urlTicker)
          ? String(item.ticker || "").slice(urlTicker.length).trim()
          : parsed.company;
        return {
          rank: index + 1,
          ...item,
          ticker: urlTicker || parsed.ticker,
          company,
          volumeChangePct: parsePercent(item.volumeChange),
        };
      })
      .filter((item) => item.volumeChangePct != null && item.volumeChangePct >= minChange)
      .slice(0, limit);

    process.stdout.write(`${JSON.stringify({
      ok: true,
      side,
      minVolumeChangePct: minChange,
      pageTitle: result.pageTitle,
      pageUrl: result.pageUrl,
      count: items.length,
      items,
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
