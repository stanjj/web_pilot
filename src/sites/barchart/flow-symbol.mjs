import { connectToTarget, createTarget, evaluate, findPageTarget, navigate } from "../../core/cdp.mjs";
import { getBarchartPort } from "./common.mjs";
import { parseBarchartFlowSymbolResponse } from "./flow.mjs";

export async function runBarchartFlowSymbol(flags) {
  const symbol = String(flags.symbol || "").trim().toUpperCase();
  const type = String(flags.type || "all").trim().toLowerCase();
  const limit = Number(flags.limit ?? 20);
  const port = getBarchartPort(flags.port);

  if (!symbol) throw new Error("Missing required --symbol");
  if (!["all", "call", "put"].includes(type)) {
    throw new Error("Invalid --type. Use all, call, or put");
  }

  const target = await findPageTarget(
    (entry) => /barchart\.com/i.test(entry.url) && /\/options\/unusual-activity\//i.test(entry.url),
    port,
  ) || await createTarget("https://www.barchart.com/options/unusual-activity/stocks", port);
  const client = await connectToTarget(target);

  try {
    await navigate(client, "https://www.barchart.com/options/unusual-activity/stocks", 4000);

    const result = await evaluate(client, `
      (async () => {
        let csrf = '';
        for (let i = 0; i < 10; i += 1) {
          csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
          if (csrf) break;
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        if (!csrf) {
          return { ok: false, code: 'no-csrf', message: 'No CSRF token found' };
        }

        const headers = { 'X-CSRF-TOKEN': csrf };
        const fields = [
          'baseSymbol','strikePrice','expirationDate','optionType',
          'lastPrice','volume','openInterest','volumeOpenInterestRatio','volatility'
        ].join(',');

        const url = '/proxies/core-api/v1/options/get?list='
          + encodeURIComponent('options.unusual_activity.stocks.us')
          + '&fields=' + encodeURIComponent(fields)
          + '&orderBy=volumeOpenInterestRatio&orderDir=desc'
          + '&raw=1&limit=500';

        try {
          const resp = await fetch(url, { credentials: 'include', headers });
          const text = await resp.text();
          return {
            ok: true,
            response: {
              ok: resp.ok,
              status: resp.status,
              text
            }
          };
        } catch (error) {
          return { ok: false, code: 'request-failed', message: String(error) };
        }
      })()
    `);

    const normalized = parseBarchartFlowSymbolResponse(result, { symbol, type, limit });

    if (!normalized.ok) {
      process.stdout.write(`${JSON.stringify(normalized, null, 2)}\n`);
      process.exitCode = normalized.needsLogin ? 2 : 1;
      return;
    }

    process.stdout.write(`${JSON.stringify(normalized, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
