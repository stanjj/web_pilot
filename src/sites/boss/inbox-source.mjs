import { evaluate } from "../../core/cdp.mjs";

export async function fetchInboxSnapshot(client) {
  const expression = `
    (() => {
      const root = document.querySelector('.user-list-content');
      const list = document.querySelectorAll('.user-list-content > ul')[1];
      if (!root || !list) {
        return { ok: false, error: 'Inbox list not found' };
      }

      const items = [...list.children].map((el, index) => {
        const nameBox = el.querySelector('.name-box');
        const spans = nameBox ? [...nameBox.querySelectorAll('span')] : [];
        const textParts = spans.map((node) => (node.textContent || '').trim()).filter(Boolean);
        const statusNode = el.querySelector('.message-status');
        const messageNode = el.querySelector('.last-msg-text');
        const timeNode = el.querySelector('.time');
        const company = textParts.length >= 2 ? textParts[1] : '';
        const title = textParts.length >= 3 ? textParts[2] : '';
        const unreadNode = [...el.querySelectorAll('*')].find((node) => {
          const text = (node.textContent || '').trim();
          const cls = node.className || '';
          return /^\\d+$/.test(text) && text !== timeNode?.textContent?.trim() && !/time|status/i.test(cls);
        });

        return {
          index,
          time: (timeNode?.textContent || '').trim(),
          name: textParts[0] || '',
          company,
          title,
          status: (statusNode?.textContent || '').trim(),
          statusClass: statusNode?.className || '',
          message: (messageNode?.textContent || '').trim(),
          unread: unreadNode ? Number((unreadNode.textContent || '').trim()) : 0,
          rawText: (el.innerText || '').trim()
        };
      });

      return {
        ok: true,
        totalUnread: null,
        items
      };
    })()
  `;

  return evaluate(client, expression);
}

export async function fetchUnreadFilterSnapshot(client) {
  const expression = `
    (() => {
      const pageText = document.body.innerText || '';
      const unreadLabel = String.fromCharCode(26410, 35835);
      const unreadMarker = unreadLabel + '(';
      const unreadIndex = pageText.indexOf(unreadMarker);
      let totalUnread = null;
      if (unreadIndex >= 0) {
        const unreadTail = pageText.slice(unreadIndex + unreadMarker.length);
        const digitMatch = unreadTail.match(/^(\\d+)/);
        totalUnread = digitMatch ? Number(digitMatch[1]) : null;
      }
      const list = document.querySelectorAll('.user-list-content > ul')[1];
      const items = list ? [...list.children].map((el, index) => {
        const nameBox = el.querySelector('.name-box');
        const spans = nameBox ? [...nameBox.querySelectorAll('span')] : [];
        const textParts = spans.map((node) => (node.textContent || '').trim()).filter(Boolean);
        const timeNode = el.querySelector('.time');
        const messageNode = el.querySelector('.last-msg-text');
        return {
          index,
          time: (timeNode?.textContent || '').trim(),
          name: textParts[0] || '',
          company: textParts[1] || '',
          title: textParts[2] || '',
          message: (messageNode?.textContent || '').trim(),
          rawText: (el.innerText || '').trim()
        };
      }) : [];

      return {
        ok: true,
        totalUnread,
        items,
        emptyState: pageText.includes('与您进行过沟通的 Boss 都会在左侧列表中显示')
      };
    })()
  `;

  return evaluate(client, expression);
}

export async function switchInboxFilter(client, label) {
  return evaluate(client, `
    (() => {
      const needle = ${JSON.stringify(String(label || "").trim())};
      const candidates = [...document.querySelectorAll('div, span, li, a, button')];
      const target = candidates.find((el) => {
        const text = (el.textContent || '').trim();
        if (text !== needle) return false;
        return !!el.offsetParent || el === document.activeElement;
      });

      if (!target) {
        return { ok: false, error: 'Filter not found: ' + needle };
      }

      target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return { ok: true, label: needle };
    })()
  `);
}