import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectXiaohongshuPage, getXiaohongshuPort, getXiaohongshuUrl } from "./common.mjs";

export async function runXiaohongshuFeed(flags) {
  const limit = Math.min(Number(flags.limit ?? 20), 30);
  const port = getXiaohongshuPort(flags.port);
  const { client } = await connectXiaohongshuPage(port);
  try {
    await navigate(client, getXiaohongshuUrl(), 4000);
    const items = await evaluate(client, `
      (() => Array.from(document.querySelectorAll('section.note-item, .note-item, a[href*="/explore/"]'))
        .slice(0, ${Math.max(1, limit)})
        .map((note, index) => {
          const titleEl = note.querySelector('.title, .note-title') || note;
          const href = note.getAttribute('href') || note.querySelector('a[href]')?.getAttribute('href') || '';
          return {
            index: index + 1,
            title: (titleEl.textContent || '').replace(/\\s+/g, ' ').trim(),
            url: href ? new URL(href, location.origin).toString() : ''
          };
        })
        .filter((item) => item.title))()
    `);
    process.stdout.write(`${JSON.stringify({ ok: true, count: items?.length || 0, items: items || [] }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
