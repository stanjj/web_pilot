function readText(value) {
  return value == null ? "" : String(value).trim();
}

export function isFeishuWorkspaceUrl(url) {
  const normalized = readText(url);
  if (!/^https?:\/\/[^/]*(feishu\.cn|larksuite\.com)\//i.test(normalized)) {
    return false;
  }

  try {
    const parsed = new URL(normalized);
    const path = parsed.pathname.replace(/\/+$/, "");
    if (/^\/(?:en_[a-z]{2}|zh_cn)?$/i.test(path) || path === "") {
      return false;
    }

    if (/\/(?:getstarted|signup|login|landing|download)(?:\/|$)/i.test(path)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function pickPreferredFeishuTarget(targets = []) {
  const candidates = Array.from(targets).filter((target) => target?.type === "page" && /(feishu\.cn|larksuite\.com)/i.test(readText(target?.url)));
  if (!candidates.length) {
    return null;
  }

  return candidates
    .map((target, index) => {
      const url = readText(target.url);
      const title = readText(target.title).toLowerCase();
      let score = 0;
      if (isFeishuWorkspaceUrl(url)) score += 100;
      if (/messenger|docs|calendar|mail|workspace|lark/i.test(title)) score += 10;
      if (/productivity superapp/i.test(title)) score -= 50;
      return { target, score, index };
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.index - right.index;
    })[0]?.target || null;
}

export function summarizeFeishuPage(snapshot = {}) {
  const url = readText(snapshot.url);
  const title = readText(snapshot.title);
  const bodyText = readText(snapshot.bodyText);
  const hasAppShell = Boolean(snapshot.hasAppShell);
  const hasSearchInput = Boolean(snapshot.hasSearchInput);
  const onWorkspacePage = isFeishuWorkspaceUrl(url);
  const looksMarketing = /productivity superapp|get started|contact sales|feishu|lark/i.test(bodyText) && !hasAppShell;
  const ready = Boolean(onWorkspacePage || hasAppShell || hasSearchInput);

  return {
    ok: ready,
    status: ready ? "Connected" : "Login or workspace required",
    url,
    title,
    loggedInHint: ready && !looksMarketing,
    onWorkspacePage,
    hasAppShell,
    hasSearchInput,
  };
}

export function ensureFeishuReady(snapshot = {}) {
  const summary = summarizeFeishuPage(snapshot);
  if (summary.ok) {
    return summary;
  }

  const error = new Error("Open a logged-in Feishu/Lark workspace page in the shared browser before using this command.");
  error.code = "FEISHU_WORKSPACE_REQUIRED";
  error.details = summary;
  throw error;
}
