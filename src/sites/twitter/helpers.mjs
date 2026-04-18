function readText(value) {
  return value == null ? "" : String(value).trim();
}

export function summarizeTwitterPage(snapshot = {}) {
  const url = readText(snapshot.url);
  const title = readText(snapshot.title);
  const bodyText = readText(snapshot.bodyText);
  const hasPrimaryColumn = Boolean(snapshot.hasPrimaryColumn);
  const hasSearchInput = Boolean(snapshot.hasSearchInput);
  const hasTweetComposer = Boolean(snapshot.hasTweetComposer);
  const currentUserName = readText(snapshot.currentUserName);
  const currentUserHandle = readText(snapshot.currentUserHandle).replace(/^@/, "");
  const currentUserUrl = readText(snapshot.currentUserUrl);
  const currentUser = currentUserHandle && currentUserUrl
    ? {
        name: currentUserName || currentUserHandle,
        handle: currentUserHandle,
        profileUrl: currentUserUrl,
      }
    : null;

  const joinedText = `${title}\n${bodyText}`.toLowerCase();
  const looksLoginGate =
    /x\.com\/i\/flow\/login|twitter\.com\/i\/flow\/login/i.test(url)
    || (/sign in to x|join today|create account/.test(joinedText) && !hasPrimaryColumn);

  const loggedIn = Boolean(hasPrimaryColumn || hasSearchInput || hasTweetComposer || currentUser) && !looksLoginGate;

  return {
    ok: loggedIn,
    status: loggedIn ? "Connected" : "Login required",
    url,
    title,
    loggedIn,
    needsLogin: !loggedIn,
    hasPrimaryColumn,
    hasSearchInput,
    hasTweetComposer,
    currentUser,
    message: loggedIn
      ? ""
      : "Open a logged-in X session in the shared agent browser before using Twitter/X commands that require search, trends, or profile context.",
  };
}
