import { buildMarketScanPayload } from "./market-runtime.mjs";

export async function runMarketScan(flags) {
  const result = await buildMarketScanPayload(flags);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}
