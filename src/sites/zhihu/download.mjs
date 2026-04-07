import fs from "node:fs/promises";
import path from "node:path";
import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectZhihuPage, getZhihuPort } from "./common.mjs";

function sanitizeFileName(value) {
  return String(value || "zhihu-article")
    .replace(/[<>:\"/\\\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "zhihu-article";
}

function toMarkdown(item) {
  const lines = [
    `# ${item.title || "Untitled"}`,
    "",
    item.author ? `作者：${item.author}` : "",
    item.url ? `原文：${item.url}` : "",
    "",
    item.summary || "",
    "",
  ].filter(Boolean);

  for (const block of item.blocks || []) {
    if (block.heading) {
      lines.push(`## ${block.heading}`, "");
    }
    if (block.text) {
      lines.push(block.text, "");
    }
  }

  return lines.join("\n").trim() + "\n";
}

export async function runZhihuDownload(flags) {
  const url = String(flags.url || "").trim();
  const outputDir = String(flags.output || "").trim();
  const port = getZhihuPort(flags.port);

  if (!url) {
    throw new Error("Missing required --url");
  }

  const { client } = await connectZhihuPage(port);

  try {
    await navigate(client, url, 3500);

    const result = await evaluate(client, `
      (() => {
        const title = document.querySelector('h1')?.textContent?.trim()
          || document.title.replace(/ - 知乎$/, '').trim();
        const author = document.querySelector('[class*="AuthorInfo-name"]')?.textContent?.trim()
          || document.querySelector('meta[name="author"]')?.content?.trim()
          || '';
        const root = document.querySelector('.Post-RichTextContainer')
          || document.querySelector('.RichContent-inner')
          || document.querySelector('article');
        if (!root) {
          return { ok: false, body: 'Could not find article content on page' };
        }

        const blocks = [];
        for (const node of Array.from(root.querySelectorAll('h2,h3,p,blockquote,li'))) {
          const text = node.textContent?.replace(/\\s+/g, ' ').trim() || '';
          if (!text) continue;
          if (node.tagName === 'H2' || node.tagName === 'H3') {
            blocks.push({ heading: text });
          } else {
            blocks.push({ text });
          }
        }

        const summary = blocks.find((x) => x.text)?.text || '';
        return {
          ok: true,
          item: {
            title,
            author,
            url: location.href,
            summary,
            blocks
          }
        };
      })()
    `);

    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        url,
        message: "Zhihu download failed.",
        body: result?.body || "",
      }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }

    const markdown = toMarkdown(result.item || {});
    let outputFile = "";

    if (outputDir) {
      const targetDir = path.resolve(process.cwd(), outputDir);
      await fs.mkdir(targetDir, { recursive: true });
      outputFile = path.join(targetDir, `${sanitizeFileName(result.item?.title)}.md`);
      await fs.writeFile(outputFile, markdown, "utf8");
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      title: result.item?.title || "",
      author: result.item?.author || "",
      url: result.item?.url || url,
      outputFile,
      size: markdown.length,
      markdown,
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
