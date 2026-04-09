import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectYahooFinancePage, getQuoteUrl, getYahooFinancePort } from "./common.mjs";
import { parseYahooFinanceQuoteDocument } from "./quote-helpers.mjs";

export { extractNumber, parseYahooFinanceQuoteDocument } from "./quote-helpers.mjs";

export async function runYahooFinanceQuote(flags) {
  const symbol = String(flags.symbol || "").trim().toUpperCase();
  if (!symbol) {
    throw new Error("Missing required --symbol");
  }

  const port = getYahooFinancePort(flags.port);
  const { client } = await connectYahooFinancePage(symbol, port);

  try {
    await navigate(client, getQuoteUrl(symbol), 3500);
    const result = await evaluate(client, `
      (() => {
        return {
          text: document.body.innerText || '',
          title: document.title,
          url: location.href
        };
      })()
    `);

    const normalized = parseYahooFinanceQuoteDocument({
      symbol,
      text: result?.text,
      title: result?.title,
      url: result?.url,
    });

    process.stdout.write(`${JSON.stringify(normalized, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
