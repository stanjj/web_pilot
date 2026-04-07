import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectBossPage } from "./common.mjs";

const FILTER_ALL = "\u5168\u90e8";
const FILTER_UNREAD = "\u672a\u8bfb";
const PLACEHOLDER_THREAD_RE = /^\u60a8\u6b63\u5728\u4e0eBoss.+\u6c9f\u901a$/;

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function fetchInboxSnapshot(client) {
  const expression = `
    (() => {
      const root = document.querySelector('.user-list-content');
      const list = document.querySelectorAll('.user-list-content > ul')[1];
      if (!root || !list) {
        return { ok: false, error: 'Inbox list not found' };
      }

      const items = [...list.children].map((el, index) => {
        const nameBox = el.querySelector('.name-box');
        const spans = nameBox ? [...nameBox.querySelectorAll('span')] : [];
        const textParts = spans.map((node) => (node.textContent || '').trim()).filter(Boolean);
        const statusNode = el.querySelector('.message-status');
        const messageNode = el.querySelector('.last-msg-text');
        const timeNode = el.querySelector('.time');
        const company = textParts.length >= 2 ? textParts[1] : '';
        const title = textParts.length >= 3 ? textParts[2] : '';
        const unreadNode = [...el.querySelectorAll('*')].find((node) => {
          const text = (node.textContent || '').trim();
          const cls = node.className || '';
          return /^\\d+$/.test(text) && text !== timeNode?.textContent?.trim() && !/time|status/i.test(cls);
        });

        return {
          index,
          time: (timeNode?.textContent || '').trim(),
          name: textParts[0] || '',
          company,
          title,
          status: (statusNode?.textContent || '').trim(),
          statusClass: statusNode?.className || '',
          message: (messageNode?.textContent || '').trim(),
          unread: unreadNode ? Number((unreadNode.textContent || '').trim()) : 0,
          rawText: (el.innerText || '').trim()
        };
      });

      return {
        ok: true,
        totalUnread: null,
        items
      };
    })()
  `;

  return evaluate(client, expression);
}

async function fetchUnreadFilterSnapshot(client) {
  const expression = `
    (() => {
      const pageText = document.body.innerText || '';
      const unreadLabel = String.fromCharCode(26410, 35835);
      const unreadMarker = unreadLabel + '(';
      const unreadIndex = pageText.indexOf(unreadMarker);
      let totalUnread = null;
      if (unreadIndex >= 0) {
        const unreadTail = pageText.slice(unreadIndex + unreadMarker.length);
        const digitMatch = unreadTail.match(/^(\\d+)/);
        totalUnread = digitMatch ? Number(digitMatch[1]) : null;
      }
      const list = document.querySelectorAll('.user-list-content > ul')[1];
      const items = list ? [...list.children].map((el, index) => {
        const nameBox = el.querySelector('.name-box');
        const spans = nameBox ? [...nameBox.querySelectorAll('span')] : [];
        const textParts = spans.map((node) => (node.textContent || '').trim()).filter(Boolean);
        const timeNode = el.querySelector('.time');
        const messageNode = el.querySelector('.last-msg-text');
        return {
          index,
          time: (timeNode?.textContent || '').trim(),
          name: textParts[0] || '',
          company: textParts[1] || '',
          title: textParts[2] || '',
          message: (messageNode?.textContent || '').trim(),
          rawText: (el.innerText || '').trim()
        };
      }) : [];

      return {
        ok: true,
        totalUnread,
        items,
        emptyState: pageText.includes('\\u4e0e\\u60a8\\u8fdb\\u884c\\u8fc7\\u6c9f\\u901a\\u7684 Boss \\u90fd\\u4f1a\\u5728\\u5de6\\u4fa7\\u5217\\u8868\\u4e2d\\u663e\\u793a')
      };
    })()
  `;

  return evaluate(client, expression);
}

function normalizeInbox(snapshot, limit) {
  const items = (snapshot?.items || []).slice(0, limit);
  return {
    ok: true,
    totalUnread: snapshot?.totalUnread ?? null,
    visibleCount: snapshot?.items?.length ?? 0,
    items,
  };
}

function normalizeBossNeedsReply(snapshot, limit) {
  const items = (snapshot?.items || []).filter(needsReply).slice(0, limit);
  return {
    ok: true,
    totalUnread: snapshot?.totalUnread ?? null,
    visibleCount: snapshot?.items?.length ?? 0,
    items,
  };
}

function normalizeBossInboxView(snapshot, limit) {
  const { items, ...base } = normalizeInbox(snapshot, limit);
  return {
    ...base,
    recent: items,
    needsReply: normalizeBossNeedsReply(snapshot, limit).items,
  };
}

function normalizeBossUnread(snapshot, limit = null) {
  const base = {
    ok: true,
    totalUnread: snapshot?.totalUnread ?? null,
    unreadVisibleCount: snapshot?.items?.length ?? 0,
    emptyState: !!snapshot?.emptyState,
  };

  if (limit == null) {
    return base;
  }

  return {
    ...base,
    items: (snapshot?.items || []).slice(0, limit),
  };
}

function isSentByMe(item) {
  return (item.statusClass || "").includes("status-delivery") || (item.statusClass || "").includes("status-read");
}

function needsReply(item) {
  if (!item.message) return false;
  if (isSentByMe(item)) return false;
  if (PLACEHOLDER_THREAD_RE.test(item.message)) return false;
  return true;
}

export {
  normalizeInbox,
  normalizeBossNeedsReply,
  normalizeBossInboxView,
  normalizeBossUnread,
  isSentByMe,
  needsReply,
};

async function switchInboxFilter(client, label) {
  return evaluate(client, `
    (() => {
      const needle = ${JSON.stringify(String(label || "").trim())};
      const candidates = [...document.querySelectorAll('div, span, li, a, button')];
      const target = candidates.find((el) => {
        const text = (el.textContent || '').trim();
        if (text !== needle) return false;
        return !!el.offsetParent || el === document.activeElement;
      });

      if (!target) {
        return { ok: false, error: 'Filter not found: ' + needle };
      }

      target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return { ok: true, label: needle };
    })()
  `);
}

async function loadInbox(flags) {
  const port = toNumber(flags.port, 9223);
  const limit = toNumber(flags.limit, 10);
  const { client } = await connectBossPage(port);

  try {
    await navigate(client, "https://www.zhipin.com/web/geek/chat", 3000);
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
