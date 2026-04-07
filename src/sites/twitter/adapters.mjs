import {
  runUiDump,
  runUiGatedWrite,
  runUiHistory,
  runUiRead,
  runUiSearch,
} from "../../core/ui-site.mjs";
import { connectTwitterPage, getTwitterPort } from "./common.mjs";

function buildAdapter(flags, url) {
  return {
    site: "twitter",
    getPort: (input) => getTwitterPort(input ?? flags.port),
    getUrl: () => url,
    connectPage: (port) => connectTwitterPage(port),
  };
}

function normalizeHandle(value) {
  return String(value || "").trim().replace(/^@/, "");
}

function normalizeTweetRef(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) return text;
  if (/^\d+$/.test(text)) return `https://x.com/i/status/${text}`;
  return text;
}

export function getTwitterProfileUrl(flags) {
  const handle = normalizeHandle(flags.username || flags.user || flags.handle);
  return handle ? `https://x.com/${handle}` : "https://x.com/home";
}

export function getTwitterSearchUrl(flags) {
  const query = String(flags.query || "").trim();
  return query
    ? `https://x.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=live`
    : "https://x.com/explore";
}

export function getTwitterThreadUrl(flags) {
  return normalizeTweetRef(flags.url || flags.tweet || flags.id) || "https://x.com/home";
}

export function getTwitterTimelineUrl(flags) {
  const tab = String(flags.tab || flags.type || "for-you").trim().toLowerCase();
  if (tab === "following") return "https://x.com/home?filter=following";
  return "https://x.com/home";
}

export function getTwitterNotificationsUrl() {
  return "https://x.com/notifications";
}

export function getTwitterBookmarksUrl() {
  return "https://x.com/i/bookmarks";
}

export function getTwitterFollowersUrl(flags) {
  const handle = normalizeHandle(flags.username || flags.user || flags.handle);
  return handle ? `https://x.com/${handle}/followers` : "https://x.com/home";
}

export function getTwitterFollowingUrl(flags) {
  const handle = normalizeHandle(flags.username || flags.user || flags.handle);
  return handle ? `https://x.com/${handle}/following` : "https://x.com/home";
}

export async function runTwitterReadForUrl(flags, url) {
  return runUiRead(flags, buildAdapter(flags, url));
}

export async function runTwitterHistoryForUrl(flags, url) {
  return runUiHistory(flags, buildAdapter(flags, url));
}

export async function runTwitterSearchForUrl(flags, url) {
  return runUiSearch(flags, buildAdapter(flags, url));
}

export async function runTwitterDumpForUrl(flags, url) {
  return runUiDump(flags, buildAdapter(flags, url));
}

export async function runTwitterGatedWrite(flags, action, label) {
  return runUiGatedWrite(flags, { action, label });
}
