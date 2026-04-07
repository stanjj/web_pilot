import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getWereadPort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getWereadUrl(path = "/") {
  return `https://weread.qq.com${path}`;
}

export async function getWereadTarget(port = DEFAULT_PORT) {
  const existing = await findPageTarget((target) => /weread\.qq\.com/i.test(target.url), port);
  if (existing) return existing;
  return createTarget(getWereadUrl(), port);
}

export async function connectWereadPage(port = DEFAULT_PORT) {
  const actualPort = getWereadPort(port);
  const target = await getWereadTarget(actualPort);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

export async function fetchWereadWebApi(path, params = {}) {
  const url = new URL(`https://weread.qq.com/web${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  const resp = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!resp.ok) {
    throw new Error(`WeRead web API HTTP ${resp.status} for ${path}`);
  }
  return resp.json();
}

export async function fetchWereadPrivateApi(client, path, params = {}) {
  const url = new URL(`https://i.weread.qq.com${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  return client.evaluate(`
    (async () => {
      const res = await fetch(${JSON.stringify(url.toString())}, { credentials: 'include' });
      const text = await res.text();
      if (!res.ok) return { ok: false, status: res.status, body: text.slice(0, 300) };
      try {
        const data = JSON.parse(text);
        if (data?.errcode === -2010) return { ok: false, needsLogin: true, body: text.slice(0, 300) };
        if (data?.errcode != null && data.errcode !== 0) return { ok: false, body: data?.errmsg || text.slice(0, 300) };
        return { ok: true, data };
      } catch (error) {
        return { ok: false, body: String(error) };
      }
    })()
  `);
}

export function formatWereadDate(ts) {
  if (!Number.isFinite(ts) || ts <= 0) return "-";
  const d = new Date(ts * 1000 + 8 * 3600_000);
  return d.toISOString().slice(0, 10);
}
