import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectBarchartPage, getBarchartPort, getQuoteUrl } from "./common.mjs";
import { parseBarchartQuoteDocument } from "./quote-helpers.mjs";

export { extractNumber, parseBarchartQuoteDocument } from "./quote-helpers.mjs";

export async function fetchBarchartQuote(flags) {
  const symbol = String(flags.symbol || "").trim().toUpperCase();
  if (!symbol) {
    throw new Error("Missing required --symbol");
  }

  const port = getBarchartPort(flags.port);
  const { client } = await connectBarchartPage(symbol, port);

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

    const normalized = parseBarchartQuoteDocument({
      symbol,
      text: result?.text,
      title: result?.title,
      url: result?.url,
    });

    return normalized;
  } finally {
    await client.close();
  }
}

export async function runBarchartQuote(flags) {
  const result = await fetchBarchartQuote(flags);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}
