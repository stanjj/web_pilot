import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectBarchartFlowPage, getBarchartFlowUrl, getBarchartPort } from "./common.mjs";
import { BARCHART_FLOW_FIELDS } from "./flow-helpers.mjs";
import { parseBarchartFlowSymbolResponse } from "./flow.mjs";

export async function fetchBarchartFlowSymbol(flags) {
  const symbol = String(flags.symbol || "").trim().toUpperCase();
  const type = String(flags.type || "all").trim().toLowerCase();
  const limit = Number(flags.limit ?? 20);
  const port = getBarchartPort(flags.port);

  if (!symbol) throw new Error("Missing required --symbol");
  if (!["all", "call", "put"].includes(type)) {
    throw new Error("Invalid --type. Use all, call, or put");
  }

  const { client } = await connectBarchartFlowPage(port);

  try {
    await navigate(client, getBarchartFlowUrl(), 4000);

    const result = await evaluate(client, `
      (async () => {
        const limit = ${Number.isFinite(limit) ? Math.max(1, limit) : 20};
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
        const fields = ${JSON.stringify(BARCHART_FLOW_FIELDS)}.join(',');
        const fetchLimit = Math.max(500, limit * 10);
        const lists = [
          'options.unusual_activity.stocks.us',
          'options.mostActive.us'
        ];
        const responses = [];

        for (const list of lists) {
          try {
            const url = '/proxies/core-api/v1/options/get?list='
              + encodeURIComponent(list)
              + '&fields=' + encodeURIComponent(fields)
              + '&orderBy=volumeOpenInterestRatio&orderDir=desc'
              + '&raw=1&limit=' + fetchLimit;

            const resp = await fetch(url, { credentials: 'include', headers });
            const text = await resp.text();
            responses.push({
              list,
              ok: resp.ok,
              status: resp.status,
              text
            });
            if (resp.status === 401 || resp.status === 403) {
              break;
            }
          } catch (error) {
            responses.push({
              list,
              ok: false,
              status: null,
              text: '',
              message: String(error)
            });
          }
        }

        return { ok: true, responses };
      })()
    `);

    const normalized = parseBarchartFlowSymbolResponse(result, { symbol, type, limit });
    return normalized;
  } finally {
    await client.close();
  }
}

export async function runBarchartFlowSymbol(flags) {
  const result = await fetchBarchartFlowSymbol(flags);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result?.ok) {
    process.exitCode = result.needsLogin ? 2 : 1;
  }
  return result;
}
