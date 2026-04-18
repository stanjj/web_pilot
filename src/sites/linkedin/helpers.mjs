function readText(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeLinkedinProfileName(value) {
  const text = readText(value);
  const match = text.match(/^view\s+(.+?)[’']s\b/i);
  return readText(match?.[1] || text);
}

export function summarizeLinkedinPage(snapshot = {}) {
  const url = readText(snapshot.url);
  const title = readText(snapshot.title);
  const bodyText = readText(snapshot.bodyText);
  const hasGlobalNav = Boolean(snapshot.hasGlobalNav);
  const hasSearchBox = Boolean(snapshot.hasSearchBox);
  const onJobsPage = /linkedin\.com\/jobs(?:\/|$)/i.test(url);
  const hasJobsShell = onJobsPage && /jobs search|results|set alert|job alert/i.test(bodyText);
  const currentUserName = normalizeLinkedinProfileName(snapshot.currentUserName);
  const currentUserUrl = readText(snapshot.currentUserUrl);
  const currentUser = currentUserName && currentUserUrl
    ? { name: currentUserName, profileUrl: currentUserUrl }
    : null;

  const joinedText = `${title}\n${bodyText}`.toLowerCase();
  const looksLoginGate =
    /linkedin\.com\/(?:login|authwall|checkpoint|uas\/login)/i.test(url)
    || /sign in to linkedin|join now|sign in to view more jobs|continue to join or sign in/.test(joinedText);

  const loggedIn = Boolean((hasGlobalNav && (hasSearchBox || hasJobsShell)) || currentUser) && !looksLoginGate;

  return {
    ok: loggedIn,
    status: loggedIn ? "Connected" : "Login required",
    url,
    title,
    loggedIn,
    needsLogin: !loggedIn,
    hasGlobalNav,
    hasSearchBox,
    currentUser,
    message: loggedIn
      ? ""
      : "Open a logged-in LinkedIn session in the shared agent browser before using LinkedIn job workflows.",
  };
}
