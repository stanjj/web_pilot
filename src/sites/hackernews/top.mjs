import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectHackerNewsPage, getHackerNewsPort, getTopUrl } from "./common.mjs";

export async function runHackerNewsTop(flags) {
  const limit = Number(flags.limit ?? 20);
  const port = getHackerNewsPort(flags.port);
  const { client } = await connectHackerNewsPage(port);

  try {
    await navigate(client, getTopUrl(), 2000);

    const result = await evaluate(client, `
      (() => {
        const limit = ${Number.isFinite(limit) ? Math.max(1, limit) : 20};
        const rows = Array.from(document.querySelectorAll('tr.athing')).slice(0, limit);
        const items = rows.map((row, index) => {
          const titleLink = row.querySelector('.titleline > a');
          const subtext = row.nextElementSibling;
          const scoreText = subtext?.querySelector('.score')?.textContent || '';
          const author = subtext?.querySelector('.hnuser')?.textContent || '';
          const links = Array.from(subtext?.querySelectorAll('a') || []);
          const commentsLink = links.find((link) => /comment/i.test(link.textContent || '')) || null;
          const commentsText = commentsLink?.textContent || '';
          const rankText = row.querySelector('.rank')?.textContent || String(index + 1);
          const id = row.getAttribute('id') || '';
          const scoreMatch = scoreText.match(/\\d+/);
          const commentsMatch = commentsText.match(/\\d+/);

          return {
            rank: Number(rankText.replace(/\\D/g, '')) || index + 1,
            id: id ? Number(id) : null,
            title: titleLink?.textContent?.trim() || '',
            score: scoreMatch ? Number(scoreMatch[0]) : 0,
            author,
            comments: commentsMatch ? Number(commentsMatch[0]) : 0,
            url: titleLink?.href || (id ? ('https://news.ycombinator.com/item?id=' + id) : '')
          };
        }).filter((item) => item.title);

        return { ok: true, count: items.length, items };
      })()
    `);

    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        status: result?.status ?? null,
        message: "Hacker News top stories request failed.",
        body: result?.body || "",
      }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    const { ok: _ok, ...data } = result;
    return data;
  } finally {
    await client.close();
  }
}
