import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectXueqiuPage, getXueqiuPort, getXueqiuUrl } from "./common.mjs";

function round(value, digits = 2) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Number(Number(value).toFixed(digits));
}

export async function runXueqiuHotStock(flags) {
  const limit = Math.min(Number(flags.limit ?? 20), 50);
  const type = String(flags.type ?? "10").trim();
  const port = getXueqiuPort(flags.port);
  const { client } = await connectXueqiuPage(port);

  try {
    await navigate(client, getXueqiuUrl(), 2500);

    const result = await evaluate(client, `
      (async () => {
        const count = ${Number.isFinite(limit) ? Math.max(1, limit) : 20};
        const type = ${JSON.stringify(type)};
        const url = 'https://stock.xueqiu.com/v5/stock/hot_stock/list.json?size=' + count + '&type=' + encodeURIComponent(type);

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

          let data;
          try {
            data = JSON.parse(text);
          } catch (error) {
            return { ok: false, status: resp.status, body: text.slice(0, 300), error: String(error) };
          }

          const items = data?.data?.items || [];
          return {
            ok: true,
            count: items.length,
            items: items.map((item, index) => ({
              rank: index + 1,
              symbol: item?.symbol || '',
              name: item?.name || '',
              price: item?.current ?? null,
              changePercent: item?.percent ?? null,
              heat: item?.value ?? null,
              rankChange: item?.rank_change ?? null,
              url: item?.symbol ? ('https://xueqiu.com/S/' + item.symbol) : ''
            }))
          };
        } catch (error) {
          return { ok: false, status: null, body: String(error) };
        }
      })()
    `);

    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        type,
        status: result?.status ?? null,
        needsLogin: Boolean(result?.needsLogin),
        message: result?.needsLogin
          ? "Xueqiu hot-stock requires a logged-in session in the shared agent browser."
          : "Xueqiu hot-stock request failed.",
        body: result?.body || "",
      }, null, 2)}\n`);
      process.exitCode = result?.needsLogin ? 2 : 1;
      return;
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      type,
      count: result.count,
      items: (result.items || []).map((item) => ({
        rank: item.rank,
        symbol: item.symbol,
        name: item.name,
        price: round(item.price),
        changePercent: round(item.changePercent),
        heat: item.heat ?? null,
        rankChange: item.rankChange ?? null,
        url: item.url,
      })),
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
