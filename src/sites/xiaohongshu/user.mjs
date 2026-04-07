import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectXiaohongshuPage, getXiaohongshuPort } from "./common.mjs";
import { normalizeXhsUserId } from "./user-helpers.mjs";

export async function runXiaohongshuUser(flags) {
  const id = String(flags.id || "").trim();
  const limit = Math.min(Number(flags.limit ?? 15), 30);
  const port = getXiaohongshuPort(flags.port);
  if (!id) throw new Error("Missing required --id");
  const userId = normalizeXhsUserId(id);
  const { client } = await connectXiaohongshuPage(port);
  try {
    await navigate(client, `https://www.xiaohongshu.com/user/profile/${userId}`, 4000);
    const result = await evaluate(client, `
      (() => {
        const items = Array.from(document.querySelectorAll('section.note-item, .note-item, a[href*="/explore/"]'))
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
          .filter((item) => item.title);
        return { ok: true, count: items.length, items, href: location.href, title: document.title };
      })()
    `);
    process.stdout.write(`${JSON.stringify({ ok: true, userId, count: result?.count || 0, items: result?.items || [], href: result?.href || "" }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
