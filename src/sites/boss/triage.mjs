import { evaluate, navigate } from "../../core/cdp.mjs";
import {
  connectBossPage,
  ensureBossPageReady,
  selectBossThread,
  waitForSelectedBossThread,
} from "./common.mjs";
import { fetchInboxSnapshot, needsReply } from "./inbox.mjs";
import { formatBossThreadSelectionError } from "./thread-selector.mjs";

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function createBossTriageDependencies(overrides = {}) {
  return {
    connectBossPage,
    navigate,
    ensureBossPageReady,
    fetchInboxSnapshot,
    needsReply,
    selectBossThread,
    waitForSelectedBossThread,
    formatBossThreadSelectionError,
    readOpenThread,
    writeOutput: (chunk) => process.stdout.write(chunk),
    ...overrides,
  };
}

/**
 * Read the currently open thread's contact info and last N messages.
 * Runs against the already-selected, already-settled conversation panel.
 *
 * @param {object} client - CDP client
 * @param {number} maxMessages - how many recent messages to return
 * @returns {Promise<{ok: boolean, contact: object, messages: object[]}>}
 */
async function readOpenThread(client, maxMessages) {
  return evaluate(
    client,
    `
    (() => {
      const root = document.querySelector('.chat-conversation');
      if (!root) return { ok: false, error: 'Conversation panel not found' };

      const top = root.querySelector('.top-info-content');
      const name = top?.querySelector('.name-text')?.textContent?.trim() || '';
      const baseInfo = top?.querySelector('.base-info');
      const companyNode = baseInfo
        ? [...baseInfo.children].find(
            (node) => node.tagName === 'SPAN' && !node.classList.contains('base-title'),
          )
        : null;
      const company = companyNode?.textContent?.trim() || '';
      const title = top?.querySelector('.base-title')?.textContent?.trim() || '';
      const position = top?.querySelector('.position-name')?.textContent?.trim() || '';
      const salary = top?.querySelector('.salary')?.textContent?.trim() || '';

      const allMessageEls = [...root.querySelectorAll('.message-item')];
      const messages = allMessageEls.slice(-${maxMessages}).map((el) => {
        const cls = el.className || '';
        let sender = 'system';
        if (cls.includes('item-friend')) sender = 'friend';
        if (cls.includes('item-myself')) sender = 'me';
        return {
          sender,
          time: el.querySelector('.time')?.textContent?.trim() || '',
          text: (el.querySelector('.message-content')?.innerText || el.innerText || '').trim(),
        };
      });

      return {
        ok: true,
        contact: { name, company, title },
        position: { name: position, salary },
        messages,
      };
    })()
  `,
  );
}

/**
 * One-command BOSS triage workflow:
 *   1. Load inbox snapshot (single CDP session, no reconnect)
 *   2. Find threads that need a reply (HR sent last, not a placeholder)
 *   3. Open the top priority thread
 *   4. Read its recent messages
 *   5. Return full context + nextStep hint for boss reply
 *
 * Flags:
 *   --messages <n>  Number of recent messages to include (default: 10)
 *   --port <n>      CDP port (default: 9223)
 */
export async function runBossTriage(flags, overrides = {}) {
  const deps = createBossTriageDependencies(overrides);
  const port = toNumber(flags.port, 9223);
  const maxMessages = toNumber(flags.messages, 10);

  const { client } = await deps.connectBossPage(port);

  try {
    await deps.navigate(client, "https://www.zhipin.com/web/geek/chat", 3000);
    await deps.ensureBossPageReady(client, "chat");

    // Step 1: snapshot
    const snapshot = await deps.fetchInboxSnapshot(client);
    if (!snapshot?.ok) {
      throw new Error(snapshot?.error || "Failed to read BOSS inbox");
    }

    const allThreads = snapshot.items || [];
    const replyNeeded = allThreads.filter((item) => deps.needsReply(item));

    if (replyNeeded.length === 0) {
      const result = {
        ok: true,
        needsReplyCount: 0,
        message: "No threads need a reply right now.",
        threads: [],
      };
      deps.writeOutput(`${JSON.stringify(result, null, 2)}\n`);
      return result;
    }

    // Step 2: open the top thread (keep same CDP session)
    const top = replyNeeded[0];
    const selection = await deps.selectBossThread(client, { index: top.index });
    if (!selection?.ok) {
      throw new Error(deps.formatBossThreadSelectionError(selection));
    }

    const settled = await deps.waitForSelectedBossThread(client, selection.expected);
    if (!settled) {
      throw new Error(`Could not open thread: ${top.name || `index ${top.index}`}`);
    }

    // Step 3: read thread
    const thread = await deps.readOpenThread(client, maxMessages);
    if (!thread?.ok) {
      throw new Error(thread?.error || "Could not read open thread messages");
    }

    const result = {
      ok: true,
      needsReplyCount: replyNeeded.length,
      openedThread: {
        index: top.index,
        name: top.name,
        company: top.company,
        title: top.title,
        lastMessage: top.message,
        time: top.time,
      },
      contact: thread.contact,
      position: thread.position,
      recentMessages: thread.messages,
      otherNeedsReply: replyNeeded.slice(1).map((t) => ({
        index: t.index,
        name: t.name,
        company: t.company,
        message: t.message,
      })),
      nextStep: `node src/cli.mjs boss reply --index ${top.index} --message "..." --dry-run --port ${port}`,
    };

    deps.writeOutput(`${JSON.stringify(result, null, 2)}\n`);
    return result;
  } finally {
    if (typeof client.close === "function") {
      await client.close().catch(() => {});
    }
  }
}
