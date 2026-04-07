import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectNotionPage, getNotionPort, getNotionUrl } from "./common.mjs";

export async function runNotionRead(flags) {
  const port = getNotionPort(flags.port);
  const { client } = await connectNotionPage(port);
  try {
    await navigate(client, getNotionUrl(), 2500);
    const result = await evaluate(client, `
      (() => {
        const titleEl = document.querySelector('[data-block-id] [placeholder="Untitled"], .notion-page-block .notranslate, h1.notion-title, [class*="title"]');
        const title = titleEl ? (titleEl.textContent || '').trim() : document.title;
        const frame = document.querySelector('.notion-page-content, [class*="page-content"], .layout-content, main');
        const content = frame ? (frame.innerText || frame.textContent || '').trim() : '';
        return { title, content };
      })()
    `);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      item: {
        title: result?.title || "Untitled",
        content: result?.content || "(empty page)",
      },
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
