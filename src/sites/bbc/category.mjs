import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectBbcPage, getBbcPort } from "./common.mjs";

const BBC_CATEGORY_FEEDS = {
  world: "https://feeds.bbci.co.uk/news/world/rss.xml",
  business: "https://feeds.bbci.co.uk/news/business/rss.xml",
  technology: "https://feeds.bbci.co.uk/news/technology/rss.xml",
  science: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
  entertainment: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml",
  health: "https://feeds.bbci.co.uk/news/health/rss.xml",
  politics: "https://feeds.bbci.co.uk/news/politics/rss.xml",
  education: "https://feeds.bbci.co.uk/news/education/rss.xml",
  uk: "https://feeds.bbci.co.uk/news/uk/rss.xml",
  asia: "https://feeds.bbci.co.uk/news/world/asia/rss.xml",
  europe: "https://feeds.bbci.co.uk/news/world/europe/rss.xml",
  us: "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml",
};

function decodeXml(text) {
  return String(text || "")
    .replace(/<!\\[CDATA\\[(.*?)\\]\\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export async function runBbcCategory(flags) {
  const category = String(flags.category || "world").trim().toLowerCase();
  const limit = Math.min(Number(flags.limit ?? 20), 50);
  const port = getBbcPort(flags.port);

  const feedUrl = BBC_CATEGORY_FEEDS[category];
  if (!feedUrl) {
    const available = Object.keys(BBC_CATEGORY_FEEDS).join(", ");
    throw new Error(`Unknown BBC category: ${category}. Available: ${available}`);
  }

  const { client } = await connectBbcPage(port);

  try {
    await navigate(client, feedUrl, 2000);

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
          const pubDate = block.match(/<pubDate>(.*?)<\\/pubDate>/)?.[1] || '';

          if (title) {
            items.push({ rank: items.length + 1, title, description, url: link, pubDate });
          }
        }

        return { ok: true, count: items.length, items };
      })()
    `);

    const data = {
      category,
      count: result.count,
      items: (result.items || []).map((item) => ({
        rank: item.rank,
        title: decodeXml(item.title).trim(),
        description: decodeXml(item.description).trim().slice(0, 200),
        url: decodeXml(item.url).trim(),
        pubDate: item.pubDate || "",
      })),
    };

    process.stdout.write(`${JSON.stringify({ ok: true, ...data }, null, 2)}\n`);
    return data;
  } finally {
    await client.close();
  }
}
