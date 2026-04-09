import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectYahooFinancePage, getQuoteUrl, getYahooFinancePort } from "./common.mjs";
import { parseYahooExpiration, parseYahooFinanceOptionsResponse } from "./options-helpers.mjs";

export { parseYahooExpiration, parseYahooFinanceOptionsResponse } from "./options-helpers.mjs";

export async function runYahooFinanceOptions(flags) {
  const symbol = String(flags.symbol || "").trim().toUpperCase();
  const type = String(flags.type || "calls").trim().toLowerCase();
  const expiration = parseYahooExpiration(flags.expiration ?? null);
  const limit = Number(flags.limit ?? 20);

  if (!symbol) {
    throw new Error("Missing required --symbol");
  }
  if (!["calls", "puts"].includes(type)) {
    throw new Error("Invalid --type. Use calls or puts");
  }

  const port = getYahooFinancePort(flags.port);
  const { client } = await connectYahooFinancePage(symbol, port);

  try {
    await navigate(client, `${getQuoteUrl(symbol)}/options`, 3500);

    const result = await evaluate(client, `
      (async () => {
        const symbol = ${JSON.stringify(symbol)};
        const type = ${JSON.stringify(type)};
        const expiration = ${expiration == null ? "null" : expiration};
        const limit = ${Number.isFinite(limit) ? Math.max(1, limit) : 20};
        const crumb = window.YAHOO?.context?.user?.crumb || '';
        const url = new URL('https://query1.finance.yahoo.com/v7/finance/options/' + encodeURIComponent(symbol));
        if (expiration != null) url.searchParams.set('date', String(expiration));
        if (crumb) url.searchParams.set('crumb', crumb);

        const resp = await fetch(url.toString(), { credentials: 'include' });
        const text = await resp.text();
        return {
          ok: resp.ok,
          status: resp.status,
          text
        };
      })()
    `);

    const normalized = parseYahooFinanceOptionsResponse({
      symbol,
      type,
      expiration,
      limit,
      status: result?.status,
      ok: result?.ok,
      text: result?.text,
    });

    if (!normalized.ok) {
      process.stdout.write(`${JSON.stringify(normalized, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }

    process.stdout.write(`${JSON.stringify(normalized, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
