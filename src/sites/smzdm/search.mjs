import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectSmzdmPage, getSmzdmPort, getSmzdmUrl } from "./common.mjs";

export async function runSmzdmSearch(flags) {
  const keyword = String(flags.keyword || "").trim();
  const limit = Number(flags.limit ?? 20);
  const port = getSmzdmPort(flags.port);

  if (!keyword) {
    throw new Error("Missing required --keyword");
  }

  const { client } = await connectSmzdmPage(port);

  try {
    const searchUrl = `https://search.smzdm.com/?c=home&s=${encodeURIComponent(keyword)}&v=b&mx_v=b`;
    await navigate(client, searchUrl, 4000);

    const result = await evaluate(client, `
      (() => {
        const limit = ${Number.isFinite(limit) ? Math.max(1, limit) : 20};
        const anchors = Array.from(document.querySelectorAll('a[title][href]')).filter((anchor) => {
          const href = anchor.href || '';
          const title = (anchor.getAttribute('title') || '').trim();
          return title
            && (
              href.includes('www.smzdm.com/p/')
              || href.includes('post.smzdm.com/')
            )
            && !href.includes('#comments');
        });

        const seen = new Set();
        const items = [];
        for (const anchor of anchors) {
          if (items.length >= limit) break;
          const title = (anchor.getAttribute('title') || anchor.textContent || '').trim();
          const url = anchor.href || '';
          if (!title || seen.has(url)) continue;
          seen.add(url);

          const container = anchor.closest('li, article, .feed-row-wide, .feed-row, .z-feed-content') || anchor.parentElement || anchor;
          const price = container.querySelector('.z-highlight')?.textContent?.trim() || '';
          const mall = container.querySelector('.feed-block-extras span, .z-feed-foot-r .feed-block-extras span')?.textContent?.trim() || '';
          const commentText = container.querySelector('.feed-btn-comment')?.textContent?.trim() || '0';
          const comments = Number.parseInt(commentText, 10) || 0;

          items.push({
            rank: items.length + 1,
            title,
            price,
            mall,
            comments,
            url
          });
        }

        if (items.length === 0) {
          return { ok: false, status: null, body: 'No results' };
        }

        return { ok: true, channel: 'dom', count: items.length, items };
      })()
    `);

    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        keyword,
        status: result?.status ?? null,
        message: "SMZDM search request failed.",
        body: result?.body || "",
      }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      keyword,
      channel: result.channel,
      count: result.count,
      items: result.items || [],
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
