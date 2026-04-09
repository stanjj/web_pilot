import { connectToTarget, createTarget, evaluate, findPageTarget, navigate } from "../../core/cdp.mjs";
import { getBarchartPort } from "./common.mjs";
import {
  normalizeBarchartFlowType,
  parseBarchartFlowResponses,
  parseBarchartFlowSymbolResponse,
} from "./flow-helpers.mjs";

export { parseBarchartFlowResponses, parseBarchartFlowSymbolResponse } from "./flow-helpers.mjs";

export async function runBarchartFlow(flags) {
  const type = normalizeBarchartFlowType(flags.type || "all");
  const limit = Number(flags.limit ?? 20);
  const port = getBarchartPort(flags.port);

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
        const limit = ${Number.isFinite(limit) ? Math.max(1, limit) : 20};
        const typeFilter = ${JSON.stringify(type)};

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
        const fetchLimit = typeFilter !== 'all' ? limit * 3 : limit;
        const lists = [
          'options.unusual_activity.stocks.us',
          'options.mostActive.us'
        ];
        const responses = [];

        for (const list of lists) {
          try {
            const url = '/proxies/core-api/v1/options/get?list=' + encodeURIComponent(list)
              + '&fields=' + encodeURIComponent(fields)
              + '&orderBy=volumeOpenInterestRatio&orderDir=desc'
              + '&raw=1&limit=' + fetchLimit;

            const resp = await fetch(url, { credentials: 'include', headers });
            const text = await resp.text();
            responses.push({ list, ok: resp.ok, status: resp.status, text });
            if (resp.status === 401 || resp.status === 403) {
              break;
            }
          } catch (error) {
            responses.push({ list, ok: false, status: null, text: '', message: String(error) });
          }
        }

        return { ok: true, responses };
      })()
    `);

    const normalized = parseBarchartFlowResponses(result, { type, limit });
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
