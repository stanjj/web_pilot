import { evaluate, navigate, pressKey } from "../../core/cdp.mjs";
import { connectDiscordPage, getDiscordPort } from "./common.mjs";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const DISCORD_HOME_ROUTE = "https://discord.com/channels/@me";
const DISCORD_SEARCH_BOX_SELECTOR = [
  '[role="combobox"][aria-label*="Search"]',
  '[role="combobox"][aria-label*="搜索"]',
  'input[type="text"][aria-label*="Search"]',
  'input[type="text"][placeholder*="Search"]',
  'input[type="text"][placeholder*="搜索"]',
].join(", ");
const DISCORD_SERVER_NODE_SELECTOR = '[data-list-item-id^="guildsnav___"]';
const DISCORD_RESULT_SELECTOR = [
  '[class*="searchResultsWrap"] [class*="searchResult"]',
  '[class*="searchResultsWrap"] [data-list-item-id]',
  '[class*="searchResult"]',
  '[class*="results"] [role="button"]',
].join(", ");

function readTextValue(value, collapseWhitespace = false) {
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

export function normalizeDiscordSearchFilters(flags = {}) {
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

export function normalizeDiscordServerEntries(entries = []) {
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

function buildDiscordSearchInputMissingMessage(context = {}) {
  const url = readTextValue(context.url) || "the current page";
  return `Discord search box not found on ${url}. Open a Discord DM or server channel before searching.`;
}

async function queryDiscordServerContext(client) {
  return evaluate(client, `
    (() => {
      const specialIds = new Set(['home', 'create-join-button', 'guild-discover-button', 'app-download-button']);
      const nodes = Array.from(document.querySelectorAll(${JSON.stringify(DISCORD_SERVER_NODE_SELECTOR)}));
      const servers = [];

      for (const node of nodes) {
        const dataListItemId = node.getAttribute('data-list-item-id') || '';
        const suffix = dataListItemId.startsWith('guildsnav___') ? dataListItemId.slice('guildsnav___'.length) : '';
        if (!suffix || specialIds.has(suffix)) continue;

        const rect = node.getBoundingClientRect();
        const text = (node.innerText || node.textContent || '').trim();
        const className = String(node.className || '');
        if (!text && !node.getAttribute('aria-label')) continue;
        if (/folderButton/i.test(className) || /文件夹/.test(text)) continue;

        servers.push({
          guildId: suffix,
          rawTitle: node.getAttribute('aria-label') || text,
          dataListItemId,
          ariaSelected: node.getAttribute('aria-selected') || '',
          className: className.slice(0, 200),
          point: {
            x: Math.round(rect.left + rect.width / 2),
            y: Math.round(rect.top + rect.height / 2),
          },
        });
      }

      return {
        url: location.href,
        title: document.title,
        servers,
      };
    })()
  `);
}

async function loadDiscordServerContext(client) {
  let context = await queryDiscordServerContext(client);
  if (Array.isArray(context?.servers) && context.servers.length > 0) {
    return context;
  }

  await navigate(client, DISCORD_HOME_ROUTE, 2500);
  context = await queryDiscordServerContext(client);
  return context;
}

async function waitForDiscordServerContext(client, guildId, timeoutMs = 8000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const snapshot = await evaluate(client, `
      (() => {
        const guildId = ${JSON.stringify(guildId)};
        const node = document.querySelector('[data-list-item-id="guildsnav___' + guildId + '"]');
        return {
          url: location.href,
          selected: Boolean(node) && (node.getAttribute('aria-selected') === 'true' || /selected/i.test(String(node.className || ''))),
          hasSearch: Boolean(document.querySelector(${JSON.stringify(DISCORD_SEARCH_BOX_SELECTOR)})),
        };
      })()
    `);

    if (snapshot?.url?.includes(`/channels/${guildId}`) || (snapshot?.selected && snapshot?.hasSearch)) {
      return snapshot;
    }

    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  return null;
}

async function activateDiscordServerNode(client, item) {
  const result = await evaluate(client, `
    (() => {
      const selector = ${JSON.stringify(`[data-list-item-id="${item.dataListItemId}"]`)};
      const node = document.querySelector(selector);
      if (!node) {
        return {
          ok: false,
          error: 'Discord server node disappeared before click.',
        };
      }

      node.click();

      return {
        ok: true,
        tag: node.tagName,
        ariaSelected: node.getAttribute('aria-selected') || '',
      };
    })()
  `);

  if (!result?.ok) {
    throw new Error(result?.error || `Failed to activate Discord server ${item.title}.`);
  }

  return result;
}

async function selectDiscordServer(client, requestedServer) {
  const context = await loadDiscordServerContext(client);
  const selection = resolveDiscordServerSelection(context?.servers || [], requestedServer);
  if (!selection.ok) {
    throw new Error(selection.error + (selection.visibleServers?.length ? ` Visible servers: ${selection.visibleServers.join(', ')}` : ""));
  }

  if (selection.item.ariaSelected === "true" || /selected/i.test(String(selection.item.className || ""))) {
    return {
      ok: true,
      title: selection.item.title,
      guildId: selection.item.guildId,
      matchType: selection.matchType,
      changed: false,
      url: context?.url || "",
    };
  }

  await activateDiscordServerNode(client, selection.item);
  const settled = await waitForDiscordServerContext(client, selection.item.guildId);
  if (!settled) {
    throw new Error(`Discord server switch timed out for ${selection.item.title}.`);
  }

  return {
    ok: true,
    title: selection.item.title,
    guildId: selection.item.guildId,
    matchType: selection.matchType,
    changed: true,
    url: settled.url || "",
  };
}

async function prepareDiscordSearchBox(client) {
  const result = await evaluate(client, `
    (() => {
      const selector = ${JSON.stringify(DISCORD_SEARCH_BOX_SELECTOR)};
      const describe = (node) => node ? ({
        tag: node.tagName,
        role: node.getAttribute('role') || '',
        ariaLabel: node.getAttribute('aria-label') || '',
        placeholder: node.getAttribute('placeholder') || '',
        className: String(node.className || '').slice(0, 200),
        text: (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
      }) : null;
      const input = document.querySelector(selector);
      if (!input) {
        return {
          ok: false,
          url: location.href,
          title: document.title,
          active: describe(document.activeElement),
        };
      }

      input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      input.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      input.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      input.focus();

      if (input.isContentEditable || input.getAttribute('contenteditable') === 'true' || input.getAttribute('role') === 'combobox') {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(input);
        range.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(range);
        input.textContent = '';
      } else if ('value' in input) {
        input.value = '';
        if (typeof input.setSelectionRange === 'function') {
          input.setSelectionRange(0, 0);
        }
      }

      input.dispatchEvent(new Event('input', { bubbles: true }));

      return {
        ok: true,
        url: location.href,
        title: document.title,
        input: describe(input),
        active: describe(document.activeElement),
      };
    })()
  `);

  if (!result?.ok) {
    throw new Error(buildDiscordSearchInputMissingMessage(result));
  }
  if (!isDiscordSearchElement(result.active)) {
    throw new Error("Discord search box could not be focused safely. Aborting to avoid typing into the message composer.");
  }
  return result;
}

async function typeIntoDiscordSearchBox(client, text) {
  const result = await evaluate(client, `
    (() => {
      const selector = ${JSON.stringify(DISCORD_SEARCH_BOX_SELECTOR)};
      const value = ${JSON.stringify(String(text ?? ""))};
      const describe = (node) => node ? ({
        tag: node.tagName,
        role: node.getAttribute('role') || '',
        ariaLabel: node.getAttribute('aria-label') || '',
        placeholder: node.getAttribute('placeholder') || '',
        className: String(node.className || '').slice(0, 200),
        text: (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160),
      }) : null;
      const input = document.querySelector(selector);
      if (!input) {
        return {
          ok: false,
          error: 'Search box not found',
          url: location.href,
          title: document.title,
          active: describe(document.activeElement),
        };
      }

      input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      input.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      input.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      input.focus();

      if (input.isContentEditable || input.getAttribute('contenteditable') === 'true' || input.getAttribute('role') === 'combobox') {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(input);
        range.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(range);

        let inserted = false;
        if (typeof document.execCommand === 'function') {
          try {
            inserted = document.execCommand('insertText', false, value);
          } catch {
            inserted = false;
          }
        }
        if (!inserted) {
          const textNode = document.createTextNode(value);
          range.insertNode(textNode);
          range.setStartAfter(textNode);
          range.collapse(true);
          selection?.removeAllRanges();
          selection?.addRange(range);
        }

      } else if ('value' in input) {
        input.value = value;
        if (typeof input.setSelectionRange === 'function') {
          input.setSelectionRange(value.length, value.length);
        }
      }

      input.dispatchEvent(new Event('input', { bubbles: true }));

      return {
        ok: true,
        url: location.href,
        title: document.title,
        input: describe(input),
        active: describe(document.activeElement),
        inputText: ('value' in input ? String(input.value || '') : (input.innerText || input.textContent || '')).replace(/\s+/g, ' ').trim(),
      };
    })()
  `);

  if (!result?.ok) {
    throw new Error(buildDiscordSearchInputMissingMessage(result));
  }
  if (!isDiscordSearchElement(result.active)) {
    throw new Error("Discord search focus moved away from the search box. Aborting to avoid typing into the message composer.");
  }
  return result;
}

async function collectDiscordSearchItems(client, limit) {
  return evaluate(client, `
    (() => Array.from(document.querySelectorAll(${JSON.stringify(DISCORD_RESULT_SELECTOR)}))
      .slice(0, ${normalizeDiscordSearchLimit(limit)})
      .map((node, index) => ({
        index: index + 1,
        title: (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim()
      }))
      .filter((item) => item.title))()
  `);
}

export async function runDiscordSearch(flags) {
  const request = normalizeDiscordSearchRequest(flags);
  const port = getDiscordPort(flags.port);
  const { client } = await connectDiscordPage(port);
  try {
    const serverContext = request.server ? await selectDiscordServer(client, request.server) : null;
    await prepareDiscordSearchBox(client);
    const typed = await typeIntoDiscordSearchBox(client, request.resolvedQuery);
    const expectedSearchText = readTextValue(request.resolvedQuery, true);
    const actualSearchText = readTextValue(typed?.inputText, true);
    if (actualSearchText !== expectedSearchText) {
      throw new Error(`Discord search text mismatch before submit. Expected ${JSON.stringify(expectedSearchText)}, got ${JSON.stringify(actualSearchText)}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 800));
    await pressKey(client, "Enter", {
      code: "Enter",
      windowsVirtualKeyCode: 13,
      nativeVirtualKeyCode: 13,
    });
    await new Promise((resolve) => setTimeout(resolve, 1400));

    const rawItems = await collectDiscordSearchItems(client, request.limit);
    const items = normalizeDiscordSearchItems(rawItems, request.limit);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      server: request.server,
      serverContext,
      query: request.query,
      resolvedQuery: request.resolvedQuery,
      filters: request.filters,
      limit: request.limit,
      count: items.length,
      items,
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
