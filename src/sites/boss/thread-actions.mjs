import { evaluate } from "../../core/cdp.mjs";
import { isBossThreadContextMatch, resolveBossThreadSelection } from "./thread-selector.mjs";

async function fetchBossThreadList(client) {
  return evaluate(client, `
    (() => {
      const list = document.querySelectorAll('.user-list-content > ul')[1];
      if (!list) return { ok: false, error: 'Inbox list not found' };
      const primaryItems = [...list.children];
      const fallbackItems = primaryItems.length ? [] : [...document.querySelectorAll('.user-list-content li[role="listitem"]')];
      const source = primaryItems.length ? 'primary' : 'fallback';
      const nodes = primaryItems.length ? primaryItems : fallbackItems;

      const items = nodes.map((el, domIndex) => {
        const nameBox = el.querySelector('.name-box');
        const spans = nameBox ? [...nameBox.querySelectorAll('span')] : [];
        const textParts = spans.map((node) => (node.textContent || '').trim()).filter(Boolean);
        const messageNode = el.querySelector('.last-msg-text');

        return {
          source,
          domIndex,
          name: textParts[0] || '',
          company: textParts[1] || '',
          title: textParts[2] || '',
          preview: (messageNode?.textContent || el.innerText || '').trim().slice(0, 240)
        };
      });

      return { ok: true, items };
    })()
  `);
}

async function clickBossThread(client, item) {
  return evaluate(client, `
    (() => {
      const list = document.querySelectorAll('.user-list-content > ul')[1];
      const target = ${JSON.stringify(item?.source || "primary")} === 'fallback'
        ? [...document.querySelectorAll('.user-list-content li[role="listitem"]')][${Number(item?.domIndex)}] || null
        : list?.children?.[${Number(item?.domIndex)}] || null;
      if (!target) {
        return { ok: false, error: 'Thread not found in DOM' };
      }

      const clickable = target.querySelector('.friend-content') || target;
      clickable.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      clickable.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      clickable.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      return { ok: true };
    })()
  `);
}

export async function selectBossThread(client, { index, name }) {
  const snapshot = await fetchBossThreadList(client);
  if (!snapshot?.ok) {
    return snapshot;
  }

  const selection = resolveBossThreadSelection(snapshot.items, { index, name });
  if (!selection?.ok) {
    return selection;
  }

  const clicked = await clickBossThread(client, selection.item);
  if (!clicked?.ok) {
    return clicked;
  }

  return {
    ok: true,
    index: selection.item.domIndex,
    matchType: selection.matchType,
    preview: selection.item.preview,
    expected: {
      name: selection.item.name,
      company: selection.item.company,
      title: selection.item.title,
    },
  };
}

export async function waitForSelectedBossThread(client, expected, timeoutMs = 6000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const current = await evaluate(client, `
      (() => {
        const top = document.querySelector('.chat-conversation .top-info-content');
        if (!top) return { name: '', company: '', title: '' };
        const baseInfo = top.querySelector('.base-info');
        const companyNode = baseInfo ? [...baseInfo.children].find((node) => node.tagName === 'SPAN' && !node.classList.contains('base-title')) : null;
        return {
          name: top.querySelector('.name-text')?.textContent?.trim() || '',
          company: companyNode?.textContent?.trim() || '',
          title: top.querySelector('.base-title')?.textContent?.trim() || ''
        };
      })()
    `);

    if (isBossThreadContextMatch(current, expected)) {
      return current;
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  return null;
}