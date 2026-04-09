import { evaluate, navigate } from "../../core/cdp.mjs";
import { needsReply } from "./inbox-helpers.mjs";
import { fetchInboxSnapshot } from "./inbox-source.mjs";
import {
  connectBossPage,
  ensureBossPageReady,
  selectBossThread,
  waitForSelectedBossThread,
} from "./common.mjs";

export {
  connectBossPage,
  ensureBossPageReady,
  fetchInboxSnapshot,
  navigate,
  needsReply,
  selectBossThread,
  waitForSelectedBossThread,
};

export async function readOpenThread(client, maxMessages) {
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