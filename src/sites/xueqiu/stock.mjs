import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectXueqiuPage, getXueqiuPort, getXueqiuUrl } from "./common.mjs";

function round(value, digits = 2) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Number(Number(value).toFixed(digits));
}

function formatAmount(value) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const num = Number(value);
  if (Math.abs(num) >= 1e12) return `${(num / 1e12).toFixed(2)}万亿`;
  if (Math.abs(num) >= 1e8) return `${(num / 1e8).toFixed(2)}亿`;
  if (Math.abs(num) >= 1e4) return `${(num / 1e4).toFixed(2)}万`;
  return String(num);
}

export async function runXueqiuStock(flags) {
  const symbol = String(flags.symbol ?? "").trim().toUpperCase();
  if (!symbol) {
    throw new Error("Missing required flag: --symbol");
  }

  const port = getXueqiuPort(flags.port);
  const { client } = await connectXueqiuPage(port);

  try {
    await navigate(client, getXueqiuUrl(), 2500);

    const result = await evaluate(client, `
      (async () => {
        const symbol = ${JSON.stringify(symbol)};
        const url = 'https://stock.xueqiu.com/v5/stock/batch/quote.json?symbol=' + encodeURIComponent(symbol);

        try {
          const resp = await fetch(url, { credentials: 'include' });
          const text = await resp.text();
          if (!resp.ok) {
            return {
              ok: false,
              status: resp.status,
              needsLogin: resp.status === 401 || resp.status === 403,
              body: text.slice(0, 300)
            };
          }

          const data = JSON.parse(text);
          const item = data?.data?.items?.[0];
          if (!item) {
            return { ok: false, status: 404, body: 'Symbol not found' };
          }
          const quote = item?.quote || {};
          const market = item?.market || {};

          return {
            ok: true,
            item: {
              name: quote?.name || '',
              symbol: quote?.symbol || symbol,
              exchange: quote?.exchange || '',
              currency: quote?.currency || '',
              price: quote?.current ?? null,
              change: quote?.chg ?? null,
              changePercent: quote?.percent ?? null,
              open: quote?.open ?? null,
              high: quote?.high ?? null,
              low: quote?.low ?? null,
              prevClose: quote?.last_close ?? null,
              amplitude: quote?.amplitude ?? null,
              volume: quote?.volume ?? null,
              amount: quote?.amount ?? null,
              turnoverRate: quote?.turnover_rate ?? null,
              marketCap: quote?.market_capital ?? null,
              floatMarketCap: quote?.float_market_capital ?? null,
              ytdPercent: quote?.current_year_percent ?? null,
              marketStatus: market?.status || null,
              time: quote?.timestamp ? new Date(quote.timestamp).toISOString() : null,
              url: quote?.symbol ? ('https://xueqiu.com/S/' + quote.symbol) : ''
            }
          };
        } catch (error) {
          return { ok: false, status: null, body: String(error) };
        }
      })()
    `);

    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        symbol,
        status: result?.status ?? null,
        needsLogin: Boolean(result?.needsLogin),
        message: result?.needsLogin
          ? "Xueqiu stock requires a logged-in session in the shared agent browser."
          : "Xueqiu stock request failed.",
        body: result?.body || "",
      }, null, 2)}\n`);
      process.exitCode = result?.needsLogin ? 2 : 1;
      return;
    }

    const item = result.item || {};
    process.stdout.write(`${JSON.stringify({
      ok: true,
      item: {
        ...item,
        price: round(item.price),
        change: round(item.change),
        changePercent: round(item.changePercent),
        open: round(item.open),
        high: round(item.high),
        low: round(item.low),
        prevClose: round(item.prevClose),
        amplitude: round(item.amplitude),
        turnoverRate: round(item.turnoverRate),
        ytdPercent: round(item.ytdPercent),
        amount: formatAmount(item.amount),
        marketCap: formatAmount(item.marketCap),
        floatMarketCap: formatAmount(item.floatMarketCap),
      },
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
