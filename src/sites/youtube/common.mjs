import { connectToTarget, createTarget, DEFAULT_PORT, findPageTarget, listTargets } from "../../core/cdp.mjs";
import { AGENT_BROWSER_PORT } from "../../core/agent-browser.mjs";
import { autoMinimizeChromeForPort } from "../../core/windows.mjs";

export function getYoutubePort(input) {
  const parsed = Number(input ?? AGENT_BROWSER_PORT ?? DEFAULT_PORT);
  return Number.isFinite(parsed) ? parsed : (AGENT_BROWSER_PORT ?? DEFAULT_PORT);
}

export function getYoutubeUrl() {
  return "https://www.youtube.com/";
}

export function parseYoutubeVideoId(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.split("/").filter(Boolean)[0] || "";
    }
    return url.searchParams.get("v") || "";
  } catch {
    return "";
  }
}

export function getYoutubeWatchUrl(urlOrId, autoplay = false) {
  const videoId = parseYoutubeVideoId(urlOrId);
  if (!videoId) return "";
  return `https://www.youtube.com/watch?v=${videoId}${autoplay ? "&autoplay=1" : ""}`;
}

export async function getYoutubeTarget(port = DEFAULT_PORT, options = {}) {
  const actualPort = getYoutubePort(port);
  const targetId = String(options.targetId || "").trim();
  const preferExisting = options.preferExisting !== false;

  if (targetId) {
    const targets = await listTargets(actualPort);
    const explicit = targets.find((target) => target?.id === targetId);
    if (!explicit) {
      throw new Error(`YouTube target not found: ${targetId}`);
    }
    return explicit;
  }

  if (preferExisting) {
    const existing = await findPageTarget(
      (target) => /youtube\.com/i.test(target.url),
      actualPort,
    );
    if (existing) return existing;
  }

  return createTarget(getYoutubeUrl(), actualPort);
}

export async function connectYoutubePage(port = DEFAULT_PORT, options = {}) {
  const actualPort = getYoutubePort(port);
  const target = await getYoutubeTarget(actualPort, options);
  const client = await connectToTarget(target);
  await autoMinimizeChromeForPort(actualPort);
  return { client, target, port: actualPort };
}
