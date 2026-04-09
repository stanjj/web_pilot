import { evaluate, navigate, pressKey } from "../../core/cdp.mjs";
import { connectDiscordPage, getDiscordPort } from "./common.mjs";
import {
  buildDiscordSearchQuery,
  isDiscordSearchElement,
  isDiscordSearchEmptyStateText,
  normalizeDiscordSearchItems,
  normalizeDiscordSearchLimit,
  normalizeDiscordSearchRequest,
  normalizeDiscordServerTitle,
  pickDefaultDiscordServer,
  quoteDiscordSearchValue,
  readTextValue,
  resolveDiscordServerSelection,
} from "./search-helpers.mjs";

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

export {
  buildDiscordSearchQuery,
  isDiscordSearchElement,
  isDiscordSearchEmptyStateText,
  normalizeDiscordSearchItems,
  normalizeDiscordSearchLimit,
  normalizeDiscordSearchRequest,
  normalizeDiscordServerTitle,
  pickDefaultDiscordServer,
  quoteDiscordSearchValue,
  resolveDiscordServerSelection,
} from "./search-helpers.mjs";

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

async function selectDefaultDiscordServer(client) {
  const context = await loadDiscordServerContext(client);
  const selection = pickDefaultDiscordServer(context?.servers || []);
  if (!selection.ok) {
    throw new Error(`${selection.error} Open a Discord server with --server or switch to a searchable channel manually.`);
  }

  if (selection.reason === "selected") {
    return {
      ok: true,
      title: selection.item.title,
      guildId: selection.item.guildId,
      matchType: "auto-selected-current",
      changed: false,
      url: context?.url || "",
    };
  }

  await activateDiscordServerNode(client, selection.item);
  const settled = await waitForDiscordServerContext(client, selection.item.guildId);
  if (!settled) {
    throw new Error(`Discord auto-selection timed out for ${selection.item.title}.`);
  }

  return {
    ok: true,
    title: selection.item.title,
    guildId: selection.item.guildId,
    matchType: "auto-selected-first-visible",
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
    let serverContext = request.server ? await selectDiscordServer(client, request.server) : null;
    try {
      await prepareDiscordSearchBox(client);
    } catch (error) {
      if (request.server) {
        throw error;
      }

      const message = String(error?.message || "");
      if (!/Discord search box not found/i.test(message)) {
        throw error;
      }

      const autoServerContext = await selectDefaultDiscordServer(client);
      await prepareDiscordSearchBox(client);
      request.server = autoServerContext.title;
      serverContext = autoServerContext;
    }
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
