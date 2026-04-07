import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getLinkedinPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getLinkedinUrl(query = "", location = "") {
  const params = new URLSearchParams();
  if (query) params.set("keywords", query);
  if (location) params.set("location", location);
  const suffix = params.toString();
  return `https://www.linkedin.com/jobs/search/${suffix ? `?${suffix}` : ""}`;
}

export async function getLinkedinTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget(
    (target) => /linkedin\.com/i.test(target.url),
    port,
  );
  if (existing) return existing;
  return createTarget(getLinkedinUrl(), port);
}

export async function connectLinkedinPage(port = DEFAULT_PORT) {
  const actualPort = getLinkedinPort(port);
  const target = await getLinkedinTarget(actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
