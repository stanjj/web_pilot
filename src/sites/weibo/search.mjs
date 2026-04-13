import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectWeiboPage, getWeiboPort } from "./common.mjs";

export async function runWeiboSearch(flags) {
  const query = String(flags.query || flags.keyword || "").trim();
  const limit = Math.min(Number(flags.limit ?? 20), 50);
  const port = getWeiboPort(flags.port);

  if (!query) {
    throw new Error("Missing required --query");
  }

  const { client } = await connectWeiboPage(port);

  try {
    const searchUrl = `https://s.weibo.com/weibo?q=${encodeURIComponent(query)}`;
    await navigate(client, searchUrl, 3000);

    const result = await evaluate(client, `
      (() => {
        const count = ${Number.isFinite(limit) ? Math.max(1, limit) : 20};

        // Try to parse search result cards
        const cards = document.querySelectorAll(
          '[action-type="feed_list_item"], .card-wrap, [class*="card"]'
        );
        const items = [];

        for (const card of cards) {
          if (items.length >= count) break;

          const contentEl = card.querySelector(
            '[node-type="feed_list_content"], .txt, [class*="content"]'
          );
          const text = contentEl?.textContent?.trim() || card.innerText?.trim() || '';
          if (!text || text.length < 10) continue;

          const authorEl = card.querySelector(
            '[nick-name], [class*="name"], a[usercard]'
          );
          const author = authorEl?.getAttribute('nick-name')
            || authorEl?.textContent?.trim()
            || '';

          const linkEl = card.querySelector('a[href*="weibo.com"]');
          const url = linkEl?.href || '';

          const likeEl = card.querySelector('[action-type="feed_list_like"] em, [class*="like"] em');
          const repostEl = card.querySelector('[action-type="feed_list_forward"] em, [class*="forward"] em');
          const commentEl = card.querySelector('[action-type="feed_list_comment"] em, [class*="comment"] em');
          const parseCount = (el) => {
            const t = el?.textContent?.trim() || '';
            const m = t.match(/\\d+/);
            return m ? Number(m[0]) : 0;
          };

          items.push({
            rank: items.length + 1,
            author,
            text: text.slice(0, 300),
            likes: parseCount(likeEl),
            reposts: parseCount(repostEl),
            comments: parseCount(commentEl),
            url,
          });
        }

        // Fallback: if no cards found, check for login requirement
        if (items.length === 0) {
          const bodyText = document.body.innerText || '';
          const needsLogin = bodyText.includes('请登录') || bodyText.includes('登录') && bodyText.length < 500;
          return {
            ok: false,
            needsLogin,
            message: needsLogin
              ? 'Weibo search requires a logged-in session.'
              : 'No search results found or page structure changed.',
          };
        }

        return { ok: true, query: ${JSON.stringify(query)}, count: items.length, items };
      })()
    `);

    if (!result?.ok) {
      const errorResult = {
        ok: false,
        query,
        needsLogin: Boolean(result?.needsLogin),
        message: result?.message || "Weibo search failed.",
      };
      process.stdout.write(`${JSON.stringify(errorResult, null, 2)}\n`);
      process.exitCode = result?.needsLogin ? 2 : 1;
      return errorResult;
    }

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result;
  } finally {
    await client.close();
  }
}
