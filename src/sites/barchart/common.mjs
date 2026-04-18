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

export function getBarchartFlowUrl() {
  return "https://www.barchart.com/options/unusual-activity/stocks";
}

async function createBarchartTargetWithRetry(url, port, attempts = 2) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await createTarget(url, port);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export async function getBarchartTarget(symbol, port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /barchart\.com/i.test(target.url) && target.url.includes(`/${symbol}/`),
    port,
  );
  if (existing) return existing;
  return createBarchartTargetWithRetry(getQuoteUrl(symbol), port);
}

export async function connectBarchartPage(symbol, port = DEFAULT_PORT, { fresh = false } = {}) {
  const actualPort = getBarchartPort(port);
  const candidates = [];
  if (!fresh) {
    const existing = await findPageTarget(
      (target) => /barchart\.com/i.test(target.url) && target.url.includes(`/${symbol}/`),
      actualPort,
    );
    if (existing) candidates.push(existing);
  }
  if (!candidates.length) {
    candidates.push(await createBarchartTargetWithRetry(getQuoteUrl(symbol), actualPort));
  }

  let lastError = null;
  for (const target of candidates) {
    try {
      const client = await connectToTarget(target);
      await autoMinimizeChromeForPort(actualPort);
      return { client, target, port: actualPort };
    } catch (error) {
      lastError = error;
    }
  }

  const freshTarget = await createBarchartTargetWithRetry(getQuoteUrl(symbol), actualPort);
  const client = await connectToTarget(freshTarget);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target: freshTarget, port: actualPort, recoveredFrom: lastError?.message || null };
}

export async function connectBarchartFlowPage(port = DEFAULT_PORT) {
  const actualPort = getBarchartPort(port);
  const existing = await findPageTarget(
    (target) => /barchart\.com/i.test(target.url) && /\/options\/unusual-activity\//i.test(target.url),
    actualPort,
  );
  const candidates = [];
  if (existing) candidates.push(existing);
  if (!existing) candidates.push(await createBarchartTargetWithRetry(getBarchartFlowUrl(), actualPort));

  let lastError = null;
  for (const target of candidates) {
    try {
      const client = await connectToTarget(target);
      await autoMinimizeChromeForPort(actualPort);
      return { client, target, port: actualPort };
    } catch (error) {
      lastError = error;
    }
  }

  const freshTarget = await createBarchartTargetWithRetry(getBarchartFlowUrl(), actualPort);
  const client = await connectToTarget(freshTarget);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target: freshTarget, port: actualPort, recoveredFrom: lastError?.message || null };
}
