import fs from "node:fs/promises";
import path from "node:path";
import { evaluate, navigate } from "./cdp.mjs";

/**
 * @typedef {Object} UiSiteAdapter
 * @property {string} site - Site name.
 * @property {(port: number) => Promise<{client: import('./cdp.mjs').CdpClient}>} connectPage
 * @property {(port?: number) => number} getPort
 * @property {() => string} getUrl
 */

/**
 * Connect to a UI site page, navigate, and execute a callback.
 * @param {Record<string, unknown>} flags
 * @param {UiSiteAdapter} adapter
 * @param {(client: import('./cdp.mjs').CdpClient) => Promise<unknown>} fn
 * @returns {Promise<unknown>}
 */
async function withPage(flags, adapter, fn) {
  const port = adapter.getPort(flags.port);
  const { client } = await adapter.connectPage(port);
  try {
    await navigate(client, adapter.getUrl(), 2500);
    return await fn(client);
  } finally {
    await client.close();
  }
}

/**
 * Read the main content of a UI site page.
 * @param {Record<string, unknown>} flags
 * @param {UiSiteAdapter} adapter
 * @returns {Promise<void>}
 */
export async function runUiRead(flags, adapter) {
  const item = await withPage(flags, adapter, async (client) => evaluate(client, `
    (() => {
      const title = document.title;
      const content = Array.from(document.querySelectorAll('main, article, [role="main"], .conversation, .messages, [class*="content"], [class*="message"], [contenteditable="false"]'))
        .map((node) => (node.innerText || node.textContent || '').trim())
        .filter(Boolean)
        .slice(0, 12)
        .join('\\n\\n');
      return { title, content: content || document.body.innerText.slice(0, 5000) };
    })()
  `));
  process.stdout.write(`${JSON.stringify({ ok: true, item }, null, 2)}\n`);
}

/**
 * List conversation history items from a UI site.
 * @param {Record<string, unknown>} flags
 * @param {UiSiteAdapter} adapter
 * @returns {Promise<void>}
 */
export async function runUiHistory(flags, adapter) {
  const items = await withPage(flags, adapter, async (client) => evaluate(client, `
    (() => Array.from(document.querySelectorAll('nav a, aside a, [role="navigation"] a, [data-testid*="history"], [class*="history"] [role="button"]'))
      .slice(0, 50)
      .map((node, index) => ({
        index: index + 1,
        title: (node.innerText || node.textContent || '').replace(/\\s+/g, ' ').trim()
      }))
      .filter((item) => item.title))()
  `));
  process.stdout.write(`${JSON.stringify({ ok: true, count: items?.length || 0, items: items || [] }, null, 2)}\n`);
}

/**
 * Detect the active model on a UI site.
 * @param {Record<string, unknown>} flags
 * @param {UiSiteAdapter} adapter
 * @returns {Promise<void>}
 */
export async function runUiModel(flags, adapter) {
  const item = await withPage(flags, adapter, async (client) => evaluate(client, `
    (() => {
      const text = document.body.innerText || '';
      const candidates = ['GPT-5', 'GPT-4', 'Claude', 'Sonnet', 'Haiku', 'o3', 'o4', 'grok', 'gemini', 'deepseek'];
      const hit = candidates.find((name) => text.toLowerCase().includes(name.toLowerCase())) || '';
      return { title: document.title, model: hit };
    })()
  `));
  process.stdout.write(`${JSON.stringify({ ok: true, item }, null, 2)}\n`);
}

/**
 * Dump page text content from a UI site.
 * @param {Record<string, unknown>} flags
 * @param {UiSiteAdapter} adapter
 * @returns {Promise<void>}
 */
export async function runUiDump(flags, adapter) {
  const item = await withPage(flags, adapter, async (client) => evaluate(client, `
    (() => ({
      title: document.title,
      url: location.href,
      codeBlockCount: document.querySelectorAll('pre, code').length,
      text: (document.body.innerText || '').slice(0, 8000)
    }))()
  `));
  process.stdout.write(`${JSON.stringify({ ok: true, item }, null, 2)}\n`);
}

/**
 * Extract code blocks from a UI site page.
 * @param {Record<string, unknown>} flags
 * @param {UiSiteAdapter} adapter
 * @returns {Promise<void>}
 */
export async function runUiExtractCode(flags, adapter) {
  const items = await withPage(flags, adapter, async (client) => evaluate(client, `
    (() => Array.from(document.querySelectorAll('pre code, pre, code'))
      .slice(0, 30)
      .map((node, index) => ({
        index: index + 1,
        language: node.getAttribute('data-language') || node.className || '',
        content: (node.innerText || node.textContent || '').trim()
      }))
      .filter((item) => item.content))()
  `));
  process.stdout.write(`${JSON.stringify({ ok: true, count: items?.length || 0, items: items || [] }, null, 2)}\n`);
}

/**
 * Extract diff blocks from a UI site page.
 * @param {Record<string, unknown>} flags
 * @param {UiSiteAdapter} adapter
 * @returns {Promise<void>}
 */
export async function runUiExtractDiff(flags, adapter) {
  const items = await withPage(flags, adapter, async (client) => evaluate(client, `
    (() => Array.from(document.querySelectorAll('pre, code, [class*="diff"]'))
      .map((node) => (node.innerText || node.textContent || '').trim())
      .filter((text) => /^[-+].+/m.test(text))
      .slice(0, 20)
      .map((content, index) => ({ index: index + 1, content })))()
  `));
  process.stdout.write(`${JSON.stringify({ ok: true, count: items?.length || 0, items: items || [] }, null, 2)}\n`);
}

/**
 * Export page content to a markdown file.
 * @param {Record<string, unknown>} flags
 * @param {UiSiteAdapter} adapter
 * @returns {Promise<void>}
 */
export async function runUiExport(flags, adapter) {
  const output = String(flags.output || `${adapter.site}-export.md`).trim();
  const item = await withPage(flags, adapter, async (client) => evaluate(client, `
    (() => ({
      title: document.title,
      content: (document.body.innerText || '').trim()
    }))()
  `));
  const outputFile = path.resolve(process.cwd(), output);
  await fs.writeFile(outputFile, `# ${item?.title || "Untitled"}\n\n${item?.content || ""}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ ok: true, outputFile }, null, 2)}\n`);
}

/**
 * Screenshot placeholder (not yet implemented).
 * @param {Record<string, unknown>} flags
 * @param {UiSiteAdapter} adapter
 * @returns {Promise<void>}
 */
export async function runUiScreenshot(flags, adapter) {
  process.stdout.write(`${JSON.stringify({
    ok: true,
    dryRun: true,
    sendBlocked: true,
    nextStep: `Screenshot export is not wired into ${adapter.site} yet in this repo.`,
  }, null, 2)}\n`);
}

/**
 * Watch a UI site page (reports current state).
 * @param {Record<string, unknown>} flags
 * @param {UiSiteAdapter} adapter
 * @returns {Promise<void>}
 */
export async function runUiWatch(flags, adapter) {
  const item = await withPage(flags, adapter, async (client) => evaluate(client, `
    (() => ({
      title: document.title,
      url: location.href,
      status: 'watch-ready'
    }))()
  `));
  process.stdout.write(`${JSON.stringify({ ok: true, item }, null, 2)}\n`);
}

/**
 * Search for input fields on a UI site page.
 * @param {Record<string, unknown>} flags
 * @param {UiSiteAdapter} adapter
 * @returns {Promise<void>}
 * @throws {Error} If --query is missing.
 */
export async function runUiSearch(flags, adapter) {
  const query = String(flags.query || "").trim();
  if (!query) throw new Error("Missing required --query");
  const items = await withPage(flags, adapter, async (client) => evaluate(client, `
    (() => Array.from(document.querySelectorAll('input[type="text"], input[placeholder*="Search"], input[placeholder*="搜索"]'))
      .map((input) => ({ placeholder: input.getAttribute('placeholder') || '' })))()
  `));
  process.stdout.write(`${JSON.stringify({ ok: true, query, hints: items || [] }, null, 2)}\n`);
}

/**
 * Gated write action — dry-run by default, sends only with explicit --apply or --send.
 * @param {Record<string, unknown>} flags
 * @param {{action?: string, label?: string}} [descriptor]
 * @returns {Promise<void>}
 */
export async function runUiGatedWrite(flags, descriptor = {}) {
  const text = String(flags.text || flags.query || flags.title || "").trim();
  const apply = flags.apply === true || flags.send === true;
  process.stdout.write(`${JSON.stringify({
    ok: true,
    action: descriptor.action || "write",
    dryRun: !apply,
    sendBlocked: !apply,
    textPreview: text.slice(0, 140),
    nextStep: apply
      ? `${descriptor.label || "Live UI write"} is intentionally gated in this repo.`
      : "Re-run with --apply only after explicit user confirmation.",
  }, null, 2)}\n`);
}
