import fs from "node:fs/promises";
import path from "node:path";
import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectNotionPage, getNotionPort, getNotionUrl } from "./common.mjs";

export async function runNotionExport(flags) {
  const output = String(flags.output || "notion-export.md").trim();
  const port = getNotionPort(flags.port);
  const { client } = await connectNotionPage(port);
  try {
    await navigate(client, getNotionUrl(), 2500);
    const result = await evaluate(client, `
      (() => {
        const titleEl = document.querySelector('[data-block-id] [placeholder="Untitled"], h1.notion-title, [class*="title"]');
        const title = titleEl ? (titleEl.textContent || '').trim() : document.title;
        const frame = document.querySelector('.notion-page-content, [class*="page-content"], main');
        const content = frame ? (frame.innerText || '').trim() : document.body.innerText;
        return { title, content };
      })()
    `);
    const markdown = `# ${result?.title || "Untitled"}\n\n${result?.content || ""}\n`;
    const outputFile = path.resolve(process.cwd(), output);
    await fs.writeFile(outputFile, markdown, "utf8");
    process.stdout.write(`${JSON.stringify({ ok: true, outputFile, size: markdown.length }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
