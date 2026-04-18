import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectHackerNewsPage, getHackerNewsPort } from "./common.mjs";

export async function runHackerNewsNew(flags) {
  const limit = Number(flags.limit ?? 20);
  const port = getHackerNewsPort(flags.port);
  const { client } = await connectHackerNewsPage(port);

  try {
    await navigate(client, "https://news.ycombinator.com/newest", 2000);

    const result = await evaluate(client, `
      (() => {
        const count = ${Number.isFinite(limit) ? Math.max(1, limit) : 20};
        const rows = Array.from(document.querySelectorAll('tr.athing')).slice(0, count);
        const items = rows.map((row, index) => {
          const titleLink = row.querySelector('.titleline > a');
          const subtext = row.nextElementSibling;
          const scoreText = subtext?.querySelector('.score')?.textContent || '';
          const author = subtext?.querySelector('.hnuser')?.textContent || '';
          const links = Array.from(subtext?.querySelectorAll('a') || []);
          const commentsLink = links.find((link) => /comment/i.test(link.textContent || '')) || null;
          const commentsText = commentsLink?.textContent || '';
          const id = row.getAttribute('id') || '';
          const scoreMatch = scoreText.match(/\\d+/);
          const commentsMatch = commentsText.match(/\\d+/);
          const ageEl = subtext?.querySelector('.age') || null;

          return {
            rank: index + 1,
            id: id ? Number(id) : null,
            title: titleLink?.textContent?.trim() || '',
            score: scoreMatch ? Number(scoreMatch[0]) : 0,
            author,
            age: ageEl?.textContent?.trim() || '',
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
        message: "Hacker News newest stories request failed.",
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

export async function runHackerNewsShow(flags) {
  const limit = Number(flags.limit ?? 20);
  const port = getHackerNewsPort(flags.port);
  const { client } = await connectHackerNewsPage(port);

  try {
    await navigate(client, "https://news.ycombinator.com/shownew", 2000);

    const result = await evaluate(client, `
      (() => {
        const count = ${Number.isFinite(limit) ? Math.max(1, limit) : 20};
        const rows = Array.from(document.querySelectorAll('tr.athing')).slice(0, count);
        const items = rows.map((row, index) => {
          const titleLink = row.querySelector('.titleline > a');
          const subtext = row.nextElementSibling;
          const scoreText = subtext?.querySelector('.score')?.textContent || '';
          const author = subtext?.querySelector('.hnuser')?.textContent || '';
          const links = Array.from(subtext?.querySelectorAll('a') || []);
          const commentsLink = links.find((link) => /comment/i.test(link.textContent || '')) || null;
          const commentsText = commentsLink?.textContent || '';
          const id = row.getAttribute('id') || '';
          const scoreMatch = scoreText.match(/\\d+/);
          const commentsMatch = commentsText.match(/\\d+/);

          return {
            rank: index + 1,
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
        message: "Hacker News Show HN request failed.",
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

export async function runHackerNewsAsk(flags) {
  const limit = Number(flags.limit ?? 20);
  const port = getHackerNewsPort(flags.port);
  const { client } = await connectHackerNewsPage(port);

  try {
    await navigate(client, "https://news.ycombinator.com/ask", 2000);

    const result = await evaluate(client, `
      (() => {
        const count = ${Number.isFinite(limit) ? Math.max(1, limit) : 20};
        const rows = Array.from(document.querySelectorAll('tr.athing')).slice(0, count);
        const items = rows.map((row, index) => {
          const titleLink = row.querySelector('.titleline > a');
          const subtext = row.nextElementSibling;
          const scoreText = subtext?.querySelector('.score')?.textContent || '';
          const author = subtext?.querySelector('.hnuser')?.textContent || '';
          const links = Array.from(subtext?.querySelectorAll('a') || []);
          const commentsLink = links.find((link) => /comment/i.test(link.textContent || '')) || null;
          const commentsText = commentsLink?.textContent || '';
          const id = row.getAttribute('id') || '';
          const scoreMatch = scoreText.match(/\\d+/);
          const commentsMatch = commentsText.match(/\\d+/);

          return {
            rank: index + 1,
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
        message: "Hacker News Ask HN request failed.",
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
