import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectBossPage, ensureBossPageReady } from "./common.mjs";
import {
  needsReply,
  normalizeBossInboxView,
  normalizeBossNeedsReply,
  normalizeBossUnread,
  normalizeInbox,
} from "./inbox-helpers.mjs";
import {
  fetchInboxSnapshot,
  fetchUnreadFilterSnapshot,
  switchInboxFilter,
} from "./inbox-source.mjs";

const FILTER_ALL = "\u5168\u90e8";
const FILTER_UNREAD = "\u672a\u8bfb";

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export {
  fetchInboxSnapshot,
  fetchUnreadFilterSnapshot,
  normalizeInbox,
  normalizeBossNeedsReply,
  normalizeBossInboxView,
  normalizeBossUnread,
  needsReply,
};

async function loadInbox(flags) {
  const port = toNumber(flags.port, 9223);
  const limit = toNumber(flags.limit, 10);
  const { client } = await connectBossPage(port);

  try {
    await navigate(client, "https://www.zhipin.com/web/geek/chat", 3000);
    await ensureBossPageReady(client, "chat");
    const snapshot = await fetchInboxSnapshot(client);
    if (!snapshot?.ok) {
      throw new Error(snapshot?.error || "Failed to read BOSS inbox");
    }
    return { snapshot, limit };
  } finally {
    await client.close();
  }
}

async function loadUnreadInbox(flags) {
  const port = toNumber(flags.port, 9223);
  const limit = toNumber(flags.limit, 20);
  const { client } = await connectBossPage(port);

  try {
    await navigate(client, "https://www.zhipin.com/web/geek/chat", 3000);
    await ensureBossPageReady(client, "chat");
    const switched = await switchInboxFilter(client, FILTER_UNREAD);
    if (!switched?.ok) {
      throw new Error(switched?.error || "Failed to switch to unread filter");
    }
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const snapshot = await fetchUnreadFilterSnapshot(client);
    if (!snapshot?.ok) {
      throw new Error(snapshot?.error || "Failed to read unread inbox");
    }
    await switchInboxFilter(client, FILTER_ALL);
    await new Promise((resolve) => setTimeout(resolve, 600));
    return { snapshot, limit };
  } finally {
    await client.close();
  }
}

export async function runBossRecent(flags) {
  const { snapshot, limit } = await loadInbox(flags);
  process.stdout.write(`${JSON.stringify(normalizeInbox(snapshot, limit), null, 2)}\n`);
}

export async function runBossNeedsReply(flags) {
  const { snapshot, limit } = await loadInbox(flags);
  process.stdout.write(`${JSON.stringify(normalizeBossNeedsReply(snapshot, limit), null, 2)}\n`);
}

export async function runBossInbox(flags) {
  const { snapshot, limit } = await loadInbox(flags);
  const data = normalizeBossInboxView(snapshot, limit);
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
  const { ok: _ok, ...jsonData } = data;
  return jsonData;
}

export async function runBossUnreadCount(flags) {
  const { snapshot } = await loadUnreadInbox(flags);
  process.stdout.write(`${JSON.stringify(normalizeBossUnread(snapshot), null, 2)}\n`);
}

export async function runBossUnreadByThread(flags) {
  const { snapshot, limit } = await loadUnreadInbox(flags);
  process.stdout.write(`${JSON.stringify(normalizeBossUnread(snapshot, limit), null, 2)}\n`);
}
