import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectBarchartPage, getBarchartPort, getQuoteUrl } from "./common.mjs";
import { parseBarchartOptionsResponse } from "./options-helpers.mjs";

export { classifyMoneyness, parseBarchartOptionsResponse } from "./options-helpers.mjs";

export async function runBarchartOptions(flags) {
  const symbol = String(flags.symbol || "").trim().toUpperCase();
  const type = String(flags.type || "Call");
  const limit = Number(flags.limit ?? 20);
  const expiration = flags.expiration ? String(flags.expiration).trim() : null;
  const strikeMin = flags["strike-min"] != null ? Number(flags["strike-min"]) : null;
  const strikeMax = flags["strike-max"] != null ? Number(flags["strike-max"]) : null;
  const moneyness = flags.moneyness ? String(flags.moneyness).trim().toLowerCase() : null;
  const port = getBarchartPort(flags.port);

  if (!symbol) {
    throw new Error("Missing required --symbol");
  }
  if (!["Call", "Put"].includes(type)) {
    throw new Error("Invalid --type. Use Call or Put");
  }
  if (moneyness && !["atm", "itm", "otm"].includes(moneyness)) {
    throw new Error("Invalid --moneyness. Use atm, itm, or otm");
  }
  if (expiration && !/^\d{4}-\d{2}-\d{2}$/.test(expiration)) {
    throw new Error("Invalid --expiration. Use YYYY-MM-DD format");
  }

  const { client } = await connectBarchartPage(symbol, port);

  try {
    await navigate(client, `${getQuoteUrl(symbol).replace("/overview", "/options")}`, 4000);

    const result = await evaluate(client, `
      (async () => {
        const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
        const headers = csrf ? { 'X-CSRF-TOKEN': csrf } : {};
        const fields = [
          'strikePrice','bidPrice','askPrice','lastPrice','priceChange',
          'volume','openInterest','volatility',
          'delta','gamma','theta','vega',
          'expirationDate','optionType','percentFromLast'
        ].join(',');
        let url = '/proxies/core-api/v1/options/chain?symbol=' + encodeURIComponent(${JSON.stringify(symbol)})
          + '&fields=' + fields + '&raw=1';
        if (${JSON.stringify(expiration)}) {
          url += '&expirationDate=' + encodeURIComponent(${JSON.stringify(expiration)});
        }

        const resp = await fetch(url, { credentials: 'include', headers });
        const text = await resp.text();
        return {
          ok: resp.ok,
          status: resp.status,
          text
        };
      })()
    `);

    const normalized = parseBarchartOptionsResponse({
      symbol,
      type,
      limit,
      expiration,
      strikeMin: Number.isFinite(strikeMin) ? strikeMin : null,
      strikeMax: Number.isFinite(strikeMax) ? strikeMax : null,
      moneyness,
      status: result?.status,
      ok: result?.ok,
      text: result?.text,
    });

    if (!normalized.ok) {
      process.stdout.write(`${JSON.stringify(normalized, null, 2)}\n`);
      if (normalized.needsLogin) process.exitCode = 2;
      else process.exitCode = 1;
      return;
    }

    process.stdout.write(`${JSON.stringify(normalized, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
