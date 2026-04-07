import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectNotionPage, getNotionPort, getNotionUrl } from "./common.mjs";

export async function runNotionFavorites(flags) {
  const port = getNotionPort(flags.port);
  const { client } = await connectNotionPage(port);
  try {
    await navigate(client, getNotionUrl(), 2500);
    const items = await evaluate(client, `
      (() => {
        const results = [];
        const headerContainer = document.querySelector('.notion-outliner-bookmarks-header-container');
        if (headerContainer) {
          let section = headerContainer.parentElement;
          if (section && section.children.length === 1) section = section.parentElement;
          if (section) {
            const treeItems = section.querySelectorAll('[role="treeitem"]');
            treeItems.forEach((item) => {
              const titleEl = item.querySelector('div.notranslate:not(.notion-record-icon)');
              const title = titleEl ? titleEl.textContent.trim() : (item.textContent || '').trim().substring(0, 80);
              const iconEl = item.querySelector('.notion-record-icon');
              const icon = iconEl ? iconEl.textContent.trim().substring(0, 4) : '';
              if (title) results.push({ index: results.length + 1, title, icon: icon || '📄' });
            });
          }
        }
        if (!results.length) {
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
          let node;
          let favEl = null;
          while ((node = walker.nextNode())) {
            const text = node.textContent.trim();
            if (text === 'Favorites' || text === '收藏' || text === '收藏夹') {
              favEl = node.parentElement;
              break;
            }
          }
          if (favEl) {
            let section = favEl;
            for (let i = 0; i < 6; i += 1) {
              const p = section.parentElement;
              if (!p || p === document.body) break;
              const treeItems = p.querySelectorAll(':scope > [role="treeitem"]');
              if (treeItems.length > 0) { section = p; break; }
              section = p;
            }
            section.querySelectorAll('[role="treeitem"]').forEach((item) => {
              const text = (item.textContent || '').trim().substring(0, 120);
              if (text && !text.match(/^(Favorites|收藏夹?)$/)) results.push({ index: results.length + 1, title: text, icon: '📄' });
            });
          }
        }
        return results;
      })()
    `);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      count: items?.length || 0,
      items: items?.length ? items : [{ index: 0, title: "No favorites found. Make sure sidebar is visible and you have favorites.", icon: "⚠️" }],
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
