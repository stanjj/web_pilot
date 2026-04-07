import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectShopbackPage, getShopbackPort, getShopbackStoreUrl } from "./common.mjs";

export async function fetchShopbackCategory(flags) {
  const slug = String(flags.slug || "").trim();
  const limit = Math.min(Number(flags.limit ?? 15), 30);
  const port = getShopbackPort(flags.port);
  const keyword = String(flags.keyword || "").trim().toLowerCase();

  if (!slug) {
    throw new Error("Missing required --slug");
  }

  const targetUrl = getShopbackStoreUrl(slug);
  const { client } = await connectShopbackPage(port, {
    url: targetUrl,
    match: (target) => target.url.startsWith(targetUrl),
  });

  try {
    await navigate(client, targetUrl, 5000);
    const result = await evaluate(client, `
      (() => {
        const limit = ${Number.isFinite(limit) ? Math.max(1, limit) : 15};
        const keyword = ${JSON.stringify(keyword)};
        const text = document.body.innerText || '';
        const headings = Array.from(document.querySelectorAll('h1,h2,h3'))
          .map((node) => (node.textContent || '').trim())
          .filter(Boolean);

        const lines = text.split('\\n').map((line) => line.trim()).filter(Boolean);
        const stopWords = new Set(['Alternatives', 'Reach us', 'ShopBack', 'Tools', 'How it works', 'Secured by', 'Payout partner']);
        const sectionNames = headings.filter((name) => !/cashback$/i.test(name) && name.length < 80);
        const sectionEntries = Object.fromEntries(sectionNames.map((name) => [name, []]));
        const items = [];
        let currentSection = null;

        for (let i = 0; i < lines.length - 1 && items.length < limit; i += 1) {
          const name = lines[i];
          const cashback = lines[i + 1] || '';
          if (sectionNames.includes(name)) {
            currentSection = name;
            continue;
          }
          if (!name || stopWords.has(name)) break;
          if (/^(Boosted Cashback Deals|Discover Featured Brands 🤖|Stay Secure Online 🛡️)$/i.test(name)) continue;
          if (/earn cashback with one click/i.test(name)) continue;
          if (/shopback'?s extension/i.test(cashback)) continue;
          if (/_[0-9]{4}-[0-9]{2}-[0-9]{2}_/i.test(name)) continue;
          if (/cashback deals/i.test(cashback)) continue;
          if (keyword && !name.toLowerCase().includes(keyword) && !cashback.toLowerCase().includes(keyword)) continue;
          if (/cashback/i.test(cashback) && name.length < 80 && !items.some((entry) => entry.name === name)) {
            const entry = { name, cashback };
            items.push(entry);
            if (currentSection && Array.isArray(sectionEntries[currentSection]) && !sectionEntries[currentSection].some((row) => row.name === name)) {
              sectionEntries[currentSection].push(entry);
            }
          }
        }

        return {
          ok: true,
          item: {
            name: document.title.replace(/ \\|.*$/, '').trim(),
            url: location.href,
            sections: headings,
            merchants: items,
            sectionEntries
          }
        };
      })()
    `);

    return result;
  } finally {
    await client.close();
  }
}

export async function runShopbackCategory(flags) {
  const result = await fetchShopbackCategory(flags);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
