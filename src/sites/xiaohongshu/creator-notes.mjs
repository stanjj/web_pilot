import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectXiaohongshuPage, getXiaohongshuPort } from "./common.mjs";

export async function runXiaohongshuCreatorNotes(flags) {
  const limit = Math.min(Number(flags.limit ?? 20), 50);
  const port = getXiaohongshuPort(flags.port);
  const { client } = await connectXiaohongshuPage(port);
  try {
    await navigate(client, "https://creator.xiaohongshu.com/new/note-manager", 4500);
    const notes = await evaluate(client, `
      (() => {
        const results = [];
        const cards = document.querySelectorAll('[class*="note-item"], [class*="noteItem"], [class*="card"]');
        cards.forEach((card) => {
          const text = card.innerText || '';
          const linkEl = card.querySelector('a[href*="/publish/"], a[href*="/note/"], a[href*="/explore/"]');
          const href = linkEl?.getAttribute('href') || '';
          const idMatch = href.match(/\\/(?:publish|explore|note)\\/([a-zA-Z0-9]+)/);
          const lines = text.split('\\n').map((l) => l.trim()).filter(Boolean);
          if (lines.length < 2) return;
          const title = lines[0];
          const dateLine = lines.find((l) => l.includes('发布于'));
          const dateMatch = dateLine?.match(/发布于\\s+(\\d{4}年\\d{2}月\\d{2}日\\s+\\d{2}:\\d{2})/);
          const metricText = dateLine ? text.replace(dateLine, ' ') : text;
          const nums = metricText.match(/(?:^|\\s)(\\d+)(?:\\s|$)/g)?.map((n) => parseInt(n.trim(), 10)) || [];
          if (title && !title.includes('全部笔记')) {
            results.push({
              id: idMatch ? idMatch[1] : '',
              title: title.replace(/\\s+/g, ' ').substring(0, 80),
              date: dateMatch ? dateMatch[1] : '',
              views: nums[0] || 0,
              likes: nums[1] || 0,
              collects: nums[2] || 0,
              comments: nums[3] || 0,
              url: href ? new URL(href, window.location.origin).toString() : '',
            });
          }
        });
        return results;
      })()
    `);
    process.stdout.write(`${JSON.stringify({ ok: true, count: Math.min(notes?.length || 0, limit), items: (notes || []).slice(0, limit) }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
