import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectCtripPage, getCtripPort, getCtripUrl } from "./common.mjs";

export async function runCtripSearch(flags) {
  const query = String(flags.query || "").trim();
  const limit = Number(flags.limit ?? 15);
  const port = getCtripPort(flags.port);

  if (!query) {
    throw new Error("Missing required --query");
  }

  const { client } = await connectCtripPage(port);

  try {
    await navigate(client, getCtripUrl(), 2500);

    const result = await evaluate(client, `
      (async () => {
        const query = ${JSON.stringify(query)};
        const limit = ${Number.isFinite(limit) ? Math.max(1, limit) : 15};
        try {
          const url = 'https://m.ctrip.com/restapi/h5api/searchapp/search?action=onekeyali&keyword=' + encodeURIComponent(query);
          const resp = await fetch(url, { credentials: 'include' });
          const text = await resp.text();
          if (!resp.ok) {
            return { ok: false, status: resp.status, body: text.slice(0, 300) };
          }

          let data;
          try {
            data = JSON.parse(text);
          } catch (error) {
            return { ok: false, status: resp.status, body: text.slice(0, 300), error: String(error) };
          }

          const raw = data?.data || data?.result || data || {};
          const items = [];
          for (const key of Object.keys(raw)) {
            const list = Array.isArray(raw[key]) ? raw[key] : [];
            for (const item of list) {
              if (items.length >= limit) break;
              items.push({
                rank: items.length + 1,
                name: item?.word || item?.name || item?.title || '',
                type: item?.type || item?.tpName || key,
                score: item?.score || '',
                price: item?.price || item?.minPrice || '',
                url: item?.url || item?.surl || ''
              });
            }
            if (items.length >= limit) break;
          }

          if (items.length === 0) {
            return { ok: false, status: null, body: 'No results' };
          }

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
        message: "Ctrip search request failed.",
        body: result?.body || "",
      }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      query,
      count: result.count,
      items: result.items || [],
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
