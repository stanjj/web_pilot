const PLACEHOLDER_THREAD_RE = /^您正在与Boss.+沟通$/;

export function normalizeInbox(snapshot, limit) {
  const items = (snapshot?.items || []).slice(0, limit);
  return {
    ok: true,
    totalUnread: snapshot?.totalUnread ?? null,
    visibleCount: snapshot?.items?.length ?? 0,
    items,
  };
}

export function normalizeBossNeedsReply(snapshot, limit) {
  const items = (snapshot?.items || []).filter(needsReply).slice(0, limit);
  return {
    ok: true,
    totalUnread: snapshot?.totalUnread ?? null,
    visibleCount: snapshot?.items?.length ?? 0,
    items,
  };
}

export function normalizeBossInboxView(snapshot, limit) {
  const { items, ...base } = normalizeInbox(snapshot, limit);
  return {
    ...base,
    recent: items,
    needsReply: normalizeBossNeedsReply(snapshot, limit).items,
  };
}

export function normalizeBossUnread(snapshot, limit = null) {
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

export function isSentByMe(item) {
  return (item.statusClass || "").includes("status-delivery") || (item.statusClass || "").includes("status-read");
}

export function needsReply(item) {
  if (!item.message) return false;
  if (isSentByMe(item)) return false;
  if (PLACEHOLDER_THREAD_RE.test(item.message)) return false;
  return true;
}