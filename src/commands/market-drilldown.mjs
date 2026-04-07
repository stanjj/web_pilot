import { runBarchartFlowSymbol } from "../sites/barchart/flow-symbol.mjs";
import { runBarchartQuote } from "../sites/barchart/quote.mjs";
import { runBarchartTechnicals } from "../sites/barchart/technicals.mjs";
import { runYahooFinanceCatalyst } from "../sites/yahoo-finance/catalyst.mjs";

async function captureJsonOutput(run) {
  const originalWrite = process.stdout.write.bind(process.stdout);
  let buffer = "";

  process.stdout.write = (chunk, encoding, callback) => {
    buffer += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString(typeof encoding === "string" ? encoding : "utf8");
    if (typeof callback === "function") callback();
    return true;
  };

  try {
    await run();
  } finally {
    process.stdout.write = originalWrite;
  }

  const text = buffer.trim();
  if (!text) throw new Error("Empty stdout");
  return JSON.parse(text);
}

function pushResult(target, key, value, errors) {
  if (value?.ok) {
    target[key] = value;
    return;
  }
  errors.push({ source: key, error: value?.message || value?.body || "Command returned a non-ok result" });
}

export async function runMarketDrilldown(flags) {
  const symbol = String(flags.symbol || "").trim().toUpperCase();
  const port = String(flags.port ?? 9223);
  const limit = Math.max(1, Math.min(Number(flags.limit ?? 5), 20));
  if (!symbol) throw new Error("Missing required --symbol");

  const result = {
    ok: true,
    symbol,
    quote: null,
    technicals: null,
    catalyst: null,
    flow: null,
    errors: [],
  };

  const commands = [
    {
      key: "quote",
      run: () => captureJsonOutput(() => runBarchartQuote({ symbol, port })),
    },
    {
      key: "technicals",
      run: () => captureJsonOutput(() => runBarchartTechnicals({ symbol, port })),
    },
    {
      key: "catalyst",
      run: () => captureJsonOutput(() => runYahooFinanceCatalyst({ symbol, limit: String(limit), port })),
    },
    {
      key: "flow",
      run: () => captureJsonOutput(() => runBarchartFlowSymbol({ symbol, limit: String(limit), port })),
    },
  ];

  for (const command of commands) {
    try {
      const payload = await command.run();
      pushResult(result, command.key, payload, result.errors);
    } catch (error) {
      result.errors.push({ source: command.key, error: error?.message || String(error) });
    }
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
