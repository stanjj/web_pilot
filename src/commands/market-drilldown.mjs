import { buildMarketDrilldownPayload } from "./market-runtime.mjs";

export async function runMarketDrilldown(flags) {
  const result = await buildMarketDrilldownPayload(flags);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}
