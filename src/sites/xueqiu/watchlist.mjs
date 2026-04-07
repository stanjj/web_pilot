import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectXueqiuPage, getXueqiuPort, getXueqiuUrl } from "./common.mjs";

function round(value, digits = 2) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Number(Number(value).toFixed(digits));
}

export async function runXueqiuWatchlist(flags) {
  const category = String(flags.category ?? "1").trim();
  const limit = Math.min(Number(flags.limit ?? 100), 100);
  const port = getXueqiuPort(flags.port);
  const { client } = await connectXueqiuPage(port);

  try {
    await navigate(client, getXueqiuUrl(), 2500);

    const result = await evaluate(client, `
      (async () => {
        const category = ${JSON.stringify(category)};
        const url = 'https://stock.xueqiu.com/v5/stock/portfolio/stock/list.json?size=100&category=' + encodeURIComponent(category) + '&pid=-1';

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
          const items = (data?.data?.stocks || []).map((item) => ({
            symbol: item?.symbol || '',
            name: item?.name || '',
            price: item?.current ?? null,
            changePercent: item?.percent ?? null,
            volume: item?.volume ?? null,
            url: item?.symbol ? ('https://xueqiu.com/S/' + item.symbol) : ''
          }));

          return { ok: true, count: items.length, items };
        } catch (error) {
          return { ok: false, status: null, body: String(error) };
        }
      })()
    `);

    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        category,
        status: result?.status ?? null,
        needsLogin: Boolean(result?.needsLogin),
        message: result?.needsLogin
          ? "Xueqiu watchlist requires a logged-in session in the shared agent browser."
          : "Xueqiu watchlist request failed.",
        body: result?.body || "",
      }, null, 2)}\n`);
      process.exitCode = result?.needsLogin ? 2 : 1;
      return;
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      category,
      count: Math.min(result.count || 0, limit),
      items: (result.items || []).slice(0, limit).map((item, index) => ({
        rank: index + 1,
        symbol: item.symbol,
        name: item.name,
        price: round(item.price),
        changePercent: round(item.changePercent),
        volume: item.volume ?? null,
        url: item.url,
      })),
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
