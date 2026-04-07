import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getShopbackPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getShopbackUrl() {
  return "https://www.shopback.com/";
}

export function getShopbackStoresUrl() {
  return "https://www.shopback.com/all-stores";
}

export function getShopbackStoreUrl(slugOrUrl) {
  const raw = String(slugOrUrl || "").trim();
  if (!raw) return getShopbackUrl();
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://www.shopback.com/${raw.replace(/^\/+/, "")}`;
}

export async function getShopbackTarget(port = DEFAULT_PORT, options = {}) {
  const match = options.match;
  const existing = await findPageTarget(
    (target) => {
      if (!/shopback\.com/i.test(target.url)) return false;
      return typeof match === "function" ? match(target) : true;
    },
    port,
  );
  if (existing) return existing;
  return createTarget(String(options.url || getShopbackUrl()), port);
}

export async function connectShopbackPage(port = DEFAULT_PORT, options = {}) {
  const actualPort = getShopbackPort(port);
  const target = await getShopbackTarget(actualPort, options);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
