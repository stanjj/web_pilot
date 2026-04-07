import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectShopbackPage, getShopbackPort, getShopbackStoreUrl } from "./common.mjs";

export async function fetchShopbackStore(flags) {
  const slug = String(flags.slug || flags.store || "").trim();
  const url = String(flags.url || "").trim();
  const limit = Math.min(Number(flags.limit ?? 8), 20);
  const port = getShopbackPort(flags.port);
  const targetUrl = getShopbackStoreUrl(url || slug);

  if (!slug && !url) {
    throw new Error("Missing required --slug or --url");
  }

  const { client } = await connectShopbackPage(port, {
    url: targetUrl,
    match: (target) => target.url.startsWith(targetUrl),
  });

  try {
    await navigate(client, targetUrl, 5000);
    return await evaluate(client, `
      (() => {
        const text = document.body.innerText || '';
        const lines = text.split('\\n').map((line) => line.trim()).filter(Boolean);
        const getNext = (label) => {
          const idx = lines.findIndex((line) => line === label);
          return idx >= 0 ? (lines[idx + 1] || '') : '';
        };

        const headings = Array.from(document.querySelectorAll('h1,h2,h3'))
          .map((node) => (node.textContent || '').trim())
          .filter(Boolean);

        const h1 = document.querySelector('h1')?.textContent?.trim() || '';
        const cashbackHeading = headings.find((value) => /cashback/i.test(value) && value !== 'Cashback timeline') || '';
        const topText = text.slice(0, 1600);
        const capMatch = topText.match(/Capped at [^\\n]+/i)?.[0] || '';
        const rewardLimitMatch = topText.match(/Up to [^\\n]*Cashback rewards[^\\n]*/i)?.[0] || '';

        const exclusionStart = lines.findIndex((line) => line === 'Exclusions');
        const refundStart = lines.findIndex((line) => line === 'Refunds, cancellations and no-shows');
        const exclusions = exclusionStart >= 0
          ? lines.slice(exclusionStart + 1, refundStart > exclusionStart ? refundStart : exclusionStart + 10)
          : [];

        const tipsStart = lines.findIndex((line) => line === 'Cashback tips');
        const similarStart = lines.findIndex((line) => line === 'Shop and earn at similar stores');
        const dealsStart = lines.findIndex((line) => line === 'Deals & Discounts');
        const dealsSectionEnd = tipsStart > dealsStart ? tipsStart : similarStart > dealsStart ? similarStart : lines.length;
        const tips = tipsStart >= 0
          ? lines.slice(tipsStart + 1, similarStart > tipsStart ? similarStart : tipsStart + 24)
          : [];
        const dealLines = dealsStart >= 0
          ? lines.slice(dealsStart + 1, dealsSectionEnd).filter(Boolean)
          : [];
        const similarLines = similarStart >= 0
          ? lines.slice(similarStart + 1).filter(Boolean)
          : [];

        const deals = [];
        for (let i = 0; i < dealLines.length && deals.length < ${Number.isFinite(limit) ? Math.max(1, limit) : 8}; i += 1) {
          const line = dealLines[i];
          if (!line || /^Amazon$/i.test(line) || /^Shop now$/i.test(line) || /^Shop Now$/i.test(line)) continue;
          if (/^Ends /i.test(line)) continue;
          const next = dealLines[i + 1] || '';
          if (/^Shop now$/i.test(next) || /^Shop Now$/i.test(next) || /^Ends /i.test(next)) {
            deals.push({ title: line });
          }
        }

        const similarStores = [];
        for (let i = 0; i < similarLines.length && similarStores.length < ${Number.isFinite(limit) ? Math.max(1, limit) : 8}; i += 1) {
          const name = similarLines[i];
          const cashback = similarLines[i + 1] || '';
          if (!name || name === h1) continue;
          if (/^(Alternatives|Reach us|ShopBack|Tools|How it works|Secured by|Payout partner)$/i.test(name)) break;
          if (!/cashback/i.test(cashback)) continue;
          if (similarStores.some((entry) => entry.name === name)) continue;
          similarStores.push({
            name,
            cashback
          });
        }

        return {
          ok: true,
          item: {
            name: h1,
            url: location.href,
            cashback: cashbackHeading,
            cap: capMatch,
            rewardLimit: rewardLimitMatch,
            trackedIn: getNext('Tracked in'),
            confirmedIn: getNext('Confirmed in'),
            exclusions,
            tips,
            deals,
            similarStores
          }
        };
      })()
    `);

  } finally {
    await client.close();
  }
}

export async function runShopbackStore(flags) {
  const result = await fetchShopbackStore(flags);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
