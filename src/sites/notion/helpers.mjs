function readText(value) {
  return value == null ? "" : String(value).trim();
}

export function isNotionWorkspaceUrl(url) {
  const normalized = readText(url);
  if (!/^https?:\/\/(?:www\.)?notion\.(?:so|com)\//i.test(normalized)) {
    return false;
  }

  try {
    const parsed = new URL(normalized);
    if (!/^(?:www\.)?notion\.(?:so|com)$/i.test(parsed.hostname)) {
      return false;
    }

    const path = parsed.pathname.replace(/\/+$/, "");
    if (path.length <= 1) {
      return false;
    }

    if (/^\/(?:onboarding|login|signup|product|pricing|about)(?:\/|$)/i.test(path)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function pickPreferredNotionTarget(targets = []) {
  const pageTargets = Array.from(targets).filter((target) => target?.type === "page");
  const notionTargets = pageTargets.filter((target) => /^https?:\/\/(?:www\.)?notion\.(?:so|com)\//i.test(readText(target?.url)));

  if (!notionTargets.length) {
    return null;
  }

  const scored = notionTargets
    .map((target, index) => {
      const url = readText(target.url);
      const title = readText(target.title).toLowerCase();
      let score = 0;

      if (isNotionWorkspaceUrl(url)) score += 100;
      if (/docs|workspace|settings|search|inbox|templates/i.test(title)) score += 10;
      if (/the ai workspace that works for you/i.test(title)) score -= 50;

      return { target, score, index };
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.index - right.index;
    });

  return scored[0]?.target || null;
}

export function summarizeNotionPage(snapshot = {}) {
  const url = readText(snapshot.url);
  const title = readText(snapshot.title);
  const bodyText = readText(snapshot.bodyText);
  const hasSidebar = Boolean(snapshot.hasSidebar);
  const hasWorkspaceFrame = Boolean(snapshot.hasWorkspaceFrame);
  const hasQuickFind = Boolean(snapshot.hasQuickFind);
  const onWorkspacePage = isNotionWorkspaceUrl(url);
  const looksOnboarding = /how do you want to use notion|tell us about your team|getting started/i.test(`${title}\n${bodyText}`);
  const looksLoggedOut = /log in|sign up|get notion free|the ai workspace that works for you/i.test(bodyText);
  const ready = Boolean(!looksOnboarding && (onWorkspacePage || hasSidebar || hasWorkspaceFrame || hasQuickFind));

  return {
    ok: ready,
    status: ready ? "Connected" : (looksLoggedOut || looksOnboarding) ? "Login or workspace required" : "Unready",
    url,
    title,
    loggedInHint: ready && !looksLoggedOut,
    onWorkspacePage,
    hasSidebar,
    hasWorkspaceFrame,
    hasQuickFind,
  };
}

export function ensureNotionWorkspaceReady(snapshot = {}) {
  const summary = summarizeNotionPage(snapshot);
  if (summary.ok) {
    return summary;
  }

  const message = summary.loggedInHint === false
    ? "Open a logged-in Notion workspace page in the shared browser before using this command."
    : "Open a Notion workspace page in the shared browser before using this command.";

  const error = new Error(message);
  error.code = "NOTION_WORKSPACE_REQUIRED";
  error.details = summary;
  throw error;
}
