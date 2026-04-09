import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";
import {
  getBarchartPort,
  getOptionsUrl,
  getQuoteUrl,
  getTechnicalAnalysisUrl,
} from "./common-helpers.mjs";

export {
  getBarchartPort,
  getOptionsUrl,
  getQuoteUrl,
  getTechnicalAnalysisUrl,
};

export async function getBarchartTarget(symbol, port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /barchart\.com/i.test(target.url) && target.url.includes(`/${symbol}/`),
    port,
  );
  if (existing) return existing;
  return createTarget(getQuoteUrl(symbol), port);
}

export async function connectBarchartPage(symbol, port = DEFAULT_PORT) {
  const actualPort = getBarchartPort(port);
  const target = await getBarchartTarget(symbol, actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
