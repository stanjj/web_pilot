import { clickPoint, evaluate, insertText, navigate } from "../../core/cdp.mjs";
import { connectBossPage, selectBossThread, waitForSelectedBossThread } from "./common.mjs";
import { formatBossThreadSelectionError, isBossThreadSelectionSafeForSend } from "./thread-selector.mjs";

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeReplyText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isClearlyArtificialMessage(message) {
  const text = normalizeReplyText(message).toLowerCase();
  if (!text) return true;
  const normalizedToken = text.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");

  const exactBlockedValues = new Set([
    "test",
    "testing",
    "probe",
    "cdp",
    "mcp",
  ]);

  if (exactBlockedValues.has(text) || exactBlockedValues.has(normalizedToken)) {
    return true;
  }

  const blockedPatterns = [
    /\bdry[\s-]?run\b/,
    /\bsafety check\b/,
    /\bhello from\b/,
    /\bvia cdp\b/,
    /\btest message\b/,
    /\bprobe message\b/,
    /\bthis is a test\b/,
  ];

  return blockedPatterns.some((pattern) => pattern.test(text));
}

export function getReplyMessageSignature(message) {
  if (!message || typeof message !== "object") return "";

  return [
    String(message.sender || "").trim(),
    normalizeReplyText(message.text),
    normalizeReplyText(message.status),
  ].join("::");
}

function getLatestOwnReply(messages) {
  return [...(Array.isArray(messages) ? messages : [])]
    .reverse()
    .find((item) => item?.sender === "me") || null;
}

export function isReplySendConfirmed(state, { message, beforeOwnMessageCount, beforeLastOwnSignature } = {}) {
  const expectedText = normalizeReplyText(message);
  const latestOwnReply = getLatestOwnReply(state?.messages);

  if (!expectedText || !latestOwnReply) {
    return false;
  }

  if (normalizeReplyText(latestOwnReply.text) !== expectedText) {
    return false;
  }

  const countIncreased = Number(state?.ownMessageCount || 0) > Number(beforeOwnMessageCount || 0);
  const signatureChanged = beforeLastOwnSignature
    ? getReplyMessageSignature(latestOwnReply) !== beforeLastOwnSignature
    : true;

  if (countIncreased || signatureChanged) {
    return true;
  }

  return false;
}

async function inspectReplyComposer(client) {
  return evaluate(client, `
    (() => {
      const input = document.querySelector('#chat-input.chat-input');
      const sendButton = document.querySelector('button.btn-send');
      return {
        ok: !!input && !!sendButton,
        hasInput: !!input,
        hasSendButton: !!sendButton,
        inputText: input?.innerText || '',
        buttonClass: sendButton?.className || ''
      };
    })()
  `);
}

async function prepareReplyInput(client, message) {
  const result = await evaluate(client, `
    (() => {
      const input = document.querySelector('#chat-input.chat-input');
      const sendButton = document.querySelector('button.btn-send');
      const lastOwnMessage = [...document.querySelectorAll('.message-item')]
        .map((el) => ({
          sender: (el.className || '').includes('item-myself') ? 'me' : ((el.className || '').includes('item-friend') ? 'friend' : 'system'),
          text: (el.querySelector('.message-content')?.innerText || el.innerText || '').trim(),
          status: (el.querySelector('.message-status')?.textContent || '').trim()
        }))
        .filter((item) => item.sender === 'me')
        .slice(-1)[0] || null;
      if (!input || !sendButton) {
        return {
          ok: false,
          error: 'Reply input not found',
          hasInput: !!input,
          hasSendButton: !!sendButton
        };
      }

      input.textContent = '';
      input.focus();

      return {
        ok: true,
        initialButtonClass: sendButton.className || '',
        inputText: input.innerText || '',
        lastOwnMessage,
        ownMessageCount: [...document.querySelectorAll('.message-item.item-myself')].length
      };
    })()
  `);

  if (!result?.ok) {
    return result;
  }

  await insertText(client, message);
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const prepared = await evaluate(client, `
    (() => {
      const input = document.querySelector('#chat-input.chat-input');
      const sendButton = document.querySelector('button.btn-send');
      if (!input || !sendButton) {
        return {
          ok: false,
          error: 'Reply input disappeared before send'
        };
      }

      const rect = sendButton.getBoundingClientRect();
      return {
        ok: true,
        text: input.innerText || '',
        messageCount: document.querySelectorAll('.message-item').length,
        ownMessageCount: document.querySelectorAll('.message-item.item-myself').length,
        buttonClass: sendButton.className || '',
        enabled: !(sendButton.className || '').includes('disabled'),
        buttonBox: {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        }
      };
    })()
  `);

  if (!prepared?.ok) {
    return prepared;
  }

  return {
    ...prepared,
    beforeLastOwnSignature: getReplyMessageSignature(result.lastOwnMessage),
  };
}

async function confirmReplySent(client, { message, beforeOwnMessageCount, beforeLastOwnSignature }, timeoutMs = 5000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const state = await evaluate(client, `
      (() => {
        const input = document.querySelector('#chat-input.chat-input');
        const allMessages = [...document.querySelectorAll('.message-item')];
        const messages = allMessages.slice(-5).map((el) => ({
          cls: el.className || '',
          sender: (el.className || '').includes('item-myself') ? 'me' : ((el.className || '').includes('item-friend') ? 'friend' : 'system'),
          text: (el.querySelector('.message-content')?.innerText || el.innerText || '').trim(),
          status: (el.querySelector('.message-status')?.textContent || '').trim()
        }));
        return {
          inputText: input?.innerText || '',
          messageCount: allMessages.length,
          ownMessageCount: allMessages.filter((el) => (el.className || '').includes('item-myself')).length,
          messages
        };
      })()
    `);

    if (isReplySendConfirmed(state, { message, beforeOwnMessageCount, beforeLastOwnSignature })) {
      return {
        ok: true,
        inputCleared: !normalizeReplyText(state?.inputText),
        messageCount: state.messageCount,
        sent: getLatestOwnReply(state?.messages),
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  return { ok: false, error: "Reply did not appear in thread after send" };
}

export async function runBossReply(flags) {
  const port = toNumber(flags.port, 9223);
  const index = flags.index !== undefined ? toNumber(flags.index, NaN) : null;
  const name = flags.name ? String(flags.name) : "";
  const message = flags.message ? String(flags.message) : "";
  const wantsSend = String(flags.send || "").toLowerCase() === "true" || flags.send === true;
  const wantsDryRun = String(flags["dry-run"] || "").toLowerCase() === "true" || flags["dry-run"] === true;
  const dryRun = wantsDryRun || !wantsSend;

  if (!Number.isInteger(index) && !name) {
    throw new Error("Missing thread selector: use --index <n> or --name <text>");
  }
  if (!message.trim()) {
    throw new Error("Missing required --message");
  }
  if (wantsSend && isClearlyArtificialMessage(message)) {
    throw new Error("Refusing to send an artificial-looking message to a real conversation");
  }

  const { client } = await connectBossPage(port);

  try {
    await navigate(client, "https://www.zhipin.com/web/geek/chat", 3000);
    const selection = await selectBossThread(client, { index, name });
    if (!selection?.ok) {
      throw new Error(formatBossThreadSelectionError(selection));
    }
    if (wantsSend && !isBossThreadSelectionSafeForSend(selection)) {
      throw new Error("Refusing live send for a fuzzy thread selector; use --index or confirm the exact identity in dry-run first");
    }

    const settled = await waitForSelectedBossThread(client, selection.expected);
    if (!settled) {
      throw new Error(`Selected thread did not open in time: ${selection.expected?.name || "unknown"}`);
    }

    if (dryRun) {
      const composer = await inspectReplyComposer(client);
      if (!composer?.ok) {
        throw new Error("Reply input not available for preview");
      }

      process.stdout.write(
        `${JSON.stringify({
          ok: true,
          dryRun: true,
          sendBlocked: !wantsSend,
          selectedIndex: selection.index,
          preview: selection.preview,
          previewMessage: message,
          contact: settled,
          composer,
          nextStep: "Re-run with --send to perform the real reply.",
        }, null, 2)}\n`,
      );
      return;
    }

    const prepared = await prepareReplyInput(client, message);
    if (!prepared?.ok) {
      throw new Error(prepared?.error || "Failed to prepare reply input");
    }
    if (!prepared.enabled) {
      throw new Error("Reply input did not enable the send button");
    }

    await clickPoint(client, prepared.buttonBox);
    const confirmation = await confirmReplySent(client, {
      message,
      beforeOwnMessageCount: prepared.ownMessageCount,
      beforeLastOwnSignature: prepared.beforeLastOwnSignature,
    });
    if (!confirmation?.ok) {
      throw new Error(confirmation?.error || "Failed to confirm reply send");
    }

    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        dryRun: false,
        selectedIndex: selection.index,
        preview: selection.preview,
        contact: settled,
        confirmation,
      }, null, 2)}\n`,
    );
  } finally {
    await client.close(1000).catch(() => {});
  }
}
