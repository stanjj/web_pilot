import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectXueqiuPage, getXueqiuPort, getXueqiuUrl } from "./common.mjs";

function round(value, digits = 2) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Number(Number(value).toFixed(digits));
}

export async function runXueqiuSearch(flags) {
  const query = String(flags.query ?? "").trim();
  if (!query) {
    throw new Error("Missing required flag: --query");
  }

  const limit = Math.min(Number(flags.limit ?? 10), 50);
  const port = getXueqiuPort(flags.port);
  const { client } = await connectXueqiuPage(port);

  try {
    await navigate(client, getXueqiuUrl(), 2500);

    const result = await evaluate(client, `
      (async () => {
        const query = ${JSON.stringify(query)};
        const count = ${Number.isFinite(limit) ? Math.max(1, limit) : 10};
        const url = 'https://xueqiu.com/stock/search.json?code=' + encodeURIComponent(query) + '&size=' + count;

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
          const items = (data?.stocks || []).map((item, index) => {
            let symbol = item?.code || '';
            if (item?.exchange === 'SH' || item?.exchange === 'SZ' || item?.exchange === 'BJ') {
              symbol = symbol.startsWith(item.exchange) ? symbol : (item.exchange + symbol);
            }
            return {
              rank: index + 1,
              symbol,
              name: item?.name || '',
              exchange: item?.exchange || '',
              price: item?.current ?? null,
              changePercent: item?.percentage ?? null,
              url: symbol ? ('https://xueqiu.com/S/' + symbol) : ''
            };
          });

          return { ok: true, count: items.length, items };
        } catch (error) {
          return { ok: false, status: null, body: String(error) };
        }
      })()
    `);

    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        query,
        status: result?.status ?? null,
        needsLogin: Boolean(result?.needsLogin),
        message: result?.needsLogin
          ? "Xueqiu search requires a logged-in session in the shared agent browser."
          : "Xueqiu search request failed.",
        body: result?.body || "",
      }, null, 2)}\n`);
      process.exitCode = result?.needsLogin ? 2 : 1;
      return;
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      query,
      count: result.count,
      items: (result.items || []).map((item) => ({
        rank: item.rank,
        symbol: item.symbol,
        name: item.name,
        exchange: item.exchange,
        price: round(item.price),
        changePercent: round(item.changePercent),
        url: item.url,
      })),
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
