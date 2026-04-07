import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectBbcPage, getBbcNewsUrl, getBbcPort } from "./common.mjs";

function decodeXml(text) {
  return String(text || "")
    .replace(/<!\\[CDATA\\[(.*?)\\]\\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export async function runBbcNews(flags) {
  const limit = Math.min(Number(flags.limit ?? 20), 50);
  const port = getBbcPort(flags.port);
  const { client } = await connectBbcPage(port);

  try {
    await navigate(client, getBbcNewsUrl(), 2000);

    const result = await evaluate(client, `
      (() => {
        const count = ${Number.isFinite(limit) ? Math.max(1, limit) : 20};
        const xml = document.documentElement.outerHTML || document.body.innerText || '';
        const items = [];
        const itemRegex = /<item>([\\s\\S]*?)<\\/item>/g;
        let match;

        while ((match = itemRegex.exec(xml)) && items.length < count) {
          const block = match[1];
          const title = block.match(/<title><!\\[CDATA\\[(.*?)\\]\\]><\\/title>/)?.[1]
            || block.match(/<title>(.*?)<\\/title>/)?.[1]
            || '';
          const description = block.match(/<description><!\\[CDATA\\[(.*?)\\]\\]><\\/description>/)?.[1]
            || block.match(/<description>(.*?)<\\/description>/)?.[1]
            || '';
          const link = block.match(/<link>(.*?)<\\/link>/)?.[1]
            || block.match(/<guid[^>]*>(.*?)<\\/guid>/)?.[1]
            || '';

          if (title) {
            items.push({
              rank: items.length + 1,
              title,
              description,
              url: link
            });
          }
        }

        return { ok: true, count: items.length, items };
      })()
    `);

    const data = {
      count: result.count,
      items: (result.items || []).map((item) => ({
        rank: item.rank,
        title: decodeXml(item.title).trim(),
        description: decodeXml(item.description).trim().slice(0, 200),
        url: decodeXml(item.url).trim(),
      })),
    };

    process.stdout.write(`${JSON.stringify({ ok: true, ...data }, null, 2)}\n`);
    return data;
  } finally {
    await client.close();
  }
}
