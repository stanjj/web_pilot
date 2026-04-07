import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectXiaohongshuPage, getXiaohongshuPort } from "./common.mjs";

export async function runXiaohongshuSearch(flags) {
  const keyword = String(flags.keyword || "").trim();
  const limit = Number(flags.limit ?? 20);
  const port = getXiaohongshuPort(flags.port);

  if (!keyword) {
    throw new Error("Missing required --keyword");
  }

  const { client } = await connectXiaohongshuPage(port);

  try {
    const url = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(keyword)}&source=web_search_result_notes`;
    await navigate(client, url, 4000);

    const result = await evaluate(client, `
      (() => {
        const limit = ${Number.isFinite(limit) ? Math.max(1, limit) : 20};
        const notes = Array.from(document.querySelectorAll('section.note-item'));
        const items = [];

        for (const note of notes) {
          if (items.length >= limit) break;
          if (note.classList.contains('query-note-item')) continue;

          const titleEl = note.querySelector('.title, .note-title, a.title');
          const authorEl = note.querySelector('.name, .author-name, .nick-name');
          const likesEl = note.querySelector('.count, .like-count, .like-wrapper .count');
          const linkEl = note.querySelector('a[href*="/explore/"], a[href*="/search_result/"], a[href*="/note/"]');
          const href = linkEl?.getAttribute('href') || '';
          const noteId = href.match(/\\/(?:explore|note)\\/([a-zA-Z0-9]+)/)?.[1] || '';
          const title = (titleEl?.textContent || '').trim();

          if (!title) continue;
          items.push({
            rank: items.length + 1,
            title,
            author: (authorEl?.textContent || '').trim(),
            likes: (likesEl?.textContent || '0').trim(),
            url: noteId ? ('https://www.xiaohongshu.com/explore/' + noteId) : ''
          });
        }

        return {
          ok: items.length > 0,
          count: items.length,
          items,
          title: document.title,
          href: location.href,
          text: (document.body.innerText || '').slice(0, 500)
        };
      })()
    `);

    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        keyword,
        status: null,
        message: "Xiaohongshu search request failed.",
        body: result?.text || "",
        href: result?.href || "",
      }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      keyword,
      count: result.count,
      items: result.items || [],
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
