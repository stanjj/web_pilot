const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export function readTextValue(value, collapseWhitespace = false) {
  if (value == null || value === true) return "";
  const text = String(value).trim();
  return collapseWhitespace ? text.replace(/\s+/g, " ") : text;
}

function pickSearchField(flags, keys) {
  for (const key of keys) {
    const value = readTextValue(flags?.[key]);
    if (value) return value;
  }
  return "";
}

export function normalizeDiscordSearchLimit(input) {
  if (input == null || input === true) return DEFAULT_LIMIT;
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(parsed), 1), MAX_LIMIT);
}

export function normalizeDiscordServerTitle(value) {
  const raw = readTextValue(value);
  if (!raw) return "";

  const lines = raw
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^未读消息[，,:：\s]*/u, "").replace(/^unread(?:\s+messages?)?[,:\s]*/iu, "").trim())
    .filter(Boolean);

  if (!lines.length) return "";

  const deduped = [];
  for (const line of lines) {
    if (deduped.at(-1) !== line) deduped.push(line);
  }

  return deduped.at(-1) || "";
}

function normalizeDiscordMatchKey(value) {
  return normalizeDiscordServerTitle(value).toLowerCase();
}

export function isDiscordSearchElement(snapshot = {}) {
  const labels = [snapshot?.ariaLabel, snapshot?.placeholder]
    .map((value) => readTextValue(value).toLowerCase())
    .filter(Boolean)
    .join(" ");
  const role = readTextValue(snapshot?.role).toLowerCase();

  if (!(labels.includes("search") || labels.includes("搜索"))) return false;
  return role === "combobox" || role === "textbox" || role === "";
}

export function quoteDiscordSearchValue(value) {
  const text = readTextValue(value);
  if (!text) return "";
  const escaped = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return /\s/.test(text) ? `"${escaped}"` : escaped;
}

function normalizeDiscordSearchFilters(flags = {}) {
  const filters = {};

  const user = pickSearchField(flags, ["user", "from", "author"]);
  const channel = pickSearchField(flags, ["channel", "in"]);
  const mentions = pickSearchField(flags, ["mentions", "mention"]);
  const has = pickSearchField(flags, ["has"]);
  const before = pickSearchField(flags, ["before"]);
  const after = pickSearchField(flags, ["after"]);
  const during = pickSearchField(flags, ["during", "date"]);

  if (user) filters.user = user;
  if (channel) filters.channel = channel;
  if (mentions) filters.mentions = mentions;
  if (has) filters.has = has;
  if (before) filters.before = before;
  if (after) filters.after = after;
  if (during) filters.during = during;

  return filters;
}

function normalizeDiscordServerEntries(entries = []) {
  return Array.from(entries)
    .map((entry) => ({
      ...entry,
      title: normalizeDiscordServerTitle(entry?.title ?? entry?.rawTitle ?? entry?.text ?? entry?.ariaLabel),
    }))
    .filter((entry) => entry.title);
}

export function resolveDiscordServerSelection(entries = [], requestedServer) {
  const server = readTextValue(requestedServer);
  if (!server) {
    throw new Error("Missing required --server");
  }

  const items = normalizeDiscordServerEntries(entries);
  const wanted = normalizeDiscordMatchKey(server);

  const exact = items.filter((item) => normalizeDiscordMatchKey(item.title) === wanted);
  if (exact.length === 1) {
    return { ok: true, item: exact[0], matchType: "exact" };
  }
  if (exact.length > 1) {
    return {
      ok: false,
      error: `Multiple Discord servers matched --server ${JSON.stringify(server)} exactly.`,
      matches: exact.map((item) => item.title),
    };
  }

  const partial = items.filter((item) => normalizeDiscordMatchKey(item.title).includes(wanted));
  if (partial.length === 1) {
    return { ok: true, item: partial[0], matchType: "partial" };
  }
  if (partial.length > 1) {
    return {
      ok: false,
      error: `Discord server match is ambiguous for ${JSON.stringify(server)}.`,
      matches: partial.map((item) => item.title),
    };
  }

  return {
    ok: false,
    error: `Discord server not found: ${server}`,
    visibleServers: items.map((item) => item.title).slice(0, 20),
  };
}

export function buildDiscordSearchQuery({ query = "", filters = {} } = {}) {
  const textQuery = readTextValue(query, true);
  const tokens = [];

  if (filters.user) tokens.push(`from:${quoteDiscordSearchValue(filters.user)}`);
  if (filters.channel) tokens.push(`in:${quoteDiscordSearchValue(filters.channel)}`);
  if (filters.mentions) tokens.push(`mentions:${quoteDiscordSearchValue(filters.mentions)}`);
  if (filters.has) tokens.push(`has:${quoteDiscordSearchValue(filters.has)}`);
  if (filters.before) tokens.push(`before:${quoteDiscordSearchValue(filters.before)}`);
  if (filters.after) tokens.push(`after:${quoteDiscordSearchValue(filters.after)}`);
  if (filters.during) tokens.push(`during:${quoteDiscordSearchValue(filters.during)}`);
  if (textQuery) tokens.push(textQuery);

  return tokens.join(" ").trim();
}

export function normalizeDiscordSearchRequest(flags = {}) {
  const server = pickSearchField(flags, ["server", "guild"]);
  const query = readTextValue(flags.query, true);
  const filters = normalizeDiscordSearchFilters(flags);
  const resolvedQuery = buildDiscordSearchQuery({ query, filters });
  const limit = normalizeDiscordSearchLimit(flags.limit);

  if (!resolvedQuery) {
    throw new Error("Provide at least one search term with --query, --user, --channel, --mentions, --has, --before, --after, or --during");
  }

  return { server, query, filters, resolvedQuery, limit };
}

export function normalizeDiscordSearchItems(items, limit = DEFAULT_LIMIT) {
  const maxItems = normalizeDiscordSearchLimit(limit);
  const titles = Array.from(Array.isArray(items) ? items : [])
    .map((item) => readTextValue(item?.title ?? item?.text ?? item, true))
    .filter(Boolean)
    .filter((title) => !isDiscordSearchEmptyStateText(title))
    .slice(0, maxItems);

  return titles.map((title, index) => ({
    index: index + 1,
    title,
  }));
}

export function isDiscordSearchEmptyStateText(value) {
  const text = readTextValue(value, true).toLowerCase();
  if (!text) return false;
  return text.includes("无结果") || text.includes("一无所获") || text.includes("no results") || text.includes("searched far and wide");
}