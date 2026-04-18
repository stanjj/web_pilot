const PLACEHOLDER_THREAD_RE = /^您正在与Boss.+沟通$/;
const SYSTEM_PROMPT_RE = /^(系统消息|系统提示|该职位|面试邀请|以上是打招呼|对方向你发起|安全提示|boss直聘提醒|您的简历已|该公司已)/i;
const ATTACHMENT_HINT_RE = /(附件|简历|resume|\.pdf|\.doc|\.docx|发送了一份|查看附件|文件已发送)/i;
const INTERVIEW_INVITE_RE = /(面试邀请|interview invite|约面试|确认面试|面试时间)/i;

export function classifyBossMessage(message) {
  const text = String(message || "").trim();
  if (!text) return { type: "empty", text };
  if (PLACEHOLDER_THREAD_RE.test(text)) return { type: "placeholder", text };
  if (SYSTEM_PROMPT_RE.test(text)) return { type: "system", text };
  if (ATTACHMENT_HINT_RE.test(text)) return { type: "attachment", text };
  if (INTERVIEW_INVITE_RE.test(text)) return { type: "interview", text };
  return { type: "message", text };
}

export function isSystemOrPlaceholder(message) {
  const { type } = classifyBossMessage(message);
  return type === "system" || type === "placeholder";
}

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