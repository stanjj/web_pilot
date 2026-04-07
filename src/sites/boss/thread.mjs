import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectBossPage, selectBossThread, waitForSelectedBossThread } from "./common.mjs";
import { formatBossThreadSelectionError } from "./thread-selector.mjs";

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function readThread(client, maxMessages) {
  const expression = `
    (() => {
      const root = document.querySelector('.chat-conversation');
      if (!root) return { ok: false, error: 'Conversation panel not found' };

      const top = root.querySelector('.top-info-content');
      const name = top?.querySelector('.name-text')?.textContent?.trim() || '';
      const baseInfo = top?.querySelector('.base-info');
      const companyNode = baseInfo ? [...baseInfo.children].find((node) => node.tagName === 'SPAN' && !node.classList.contains('base-title')) : null;
      const company = companyNode?.textContent?.trim() || '';
      const title = top?.querySelector('.base-title')?.textContent?.trim() || '';
      const position = top?.querySelector('.position-name')?.textContent?.trim() || '';
      const salary = top?.querySelector('.salary')?.textContent?.trim() || '';
      const locationText = [...(top?.querySelectorAll('.chat-position-content span') || [])]
        .map((node) => (node.textContent || '').trim())
        .filter(Boolean);

      const messages = [...root.querySelectorAll('.message-item')].map((el) => {
        const cls = el.className || '';
        const time = el.querySelector('.time')?.textContent?.trim() || '';
        const status = el.querySelector('.message-status')?.textContent?.trim() || '';
        const text = (el.querySelector('.message-content')?.innerText || el.innerText || '').trim();
        let sender = 'system';
        if (cls.includes('item-friend')) sender = 'friend';
        if (cls.includes('item-myself')) sender = 'me';
        return {
          sender,
          className: cls,
          time,
          status,
          text
        };
      });

      return {
        ok: true,
        contact: { name, company, title },
        position: {
          name: position,
          salary,
          location: locationText.filter((value) => value !== position && value !== salary && value !== '查看职位').join(' ')
        },
        messages: messages.slice(-${maxMessages})
      };
    })()
  `;

  return evaluate(client, expression);
}

export async function runBossThread(flags) {
  const port = toNumber(flags.port, 9223);
  const index = flags.index !== undefined ? toNumber(flags.index, NaN) : null;
  const name = flags.name ? String(flags.name) : "";
  const maxMessages = toNumber(flags.messages, 20);

  if (!Number.isInteger(index) && !name) {
    throw new Error("Missing thread selector: use --index <n> or --name <text>");
  }

  const { client } = await connectBossPage(port);

  try {
    await navigate(client, "https://www.zhipin.com/web/geek/chat", 3000);
    const selection = await selectBossThread(client, { index, name });
    if (!selection?.ok) {
      throw new Error(formatBossThreadSelectionError(selection));
    }

    const settled = await waitForSelectedBossThread(client, selection.expected);
    if (!settled) {
      throw new Error(`Selected thread did not open in time: ${selection.expected?.name || "unknown"}`);
    }

    const thread = await readThread(client, maxMessages);
    if (!thread?.ok) {
      throw new Error(thread?.error || "Failed to read thread");
    }

    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        selectedIndex: selection.index,
        preview: selection.preview,
        ...thread,
      }, null, 2)}\n`,
    );
  } finally {
    await client.close();
  }
}
