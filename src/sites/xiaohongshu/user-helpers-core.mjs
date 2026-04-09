function toCleanString(value) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

export function normalizeXhsUserId(input) {
  const trimmed = toCleanString(input);
  const withoutQuery = trimmed.replace(/[?#].*$/, "");
  const matched = withoutQuery.match(/\/user\/profile\/([a-zA-Z0-9]+)/);
  if (matched?.[1]) return matched[1];
  return withoutQuery.replace(/\/+$/, "").split("/").pop() ?? withoutQuery;
}

export function buildXhsNoteUrl(userId, noteId, xsecToken) {
  const cleanUserId = toCleanString(userId);
  const cleanNoteId = toCleanString(noteId);
  if (!cleanUserId || !cleanNoteId) return "";
  const url = new URL(`https://www.xiaohongshu.com/user/profile/${cleanUserId}/${cleanNoteId}`);
  const cleanToken = toCleanString(xsecToken);
  if (cleanToken) {
    url.searchParams.set("xsec_token", cleanToken);
    url.searchParams.set("xsec_source", "pc_user");
  }
  return url.toString();
}