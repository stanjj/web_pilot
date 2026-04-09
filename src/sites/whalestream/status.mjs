import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectWhaleStreamPage, getWhaleStreamPort, getWhaleStreamTopOptionsUrl } from "./common.mjs";
import { summarizeWhaleStreamStatusSnapshot } from "./helpers.mjs";

export async function runWhaleStreamStatus(flags) {
  const port = getWhaleStreamPort(flags.port);
  const { client } = await connectWhaleStreamPage(port);

  try {
    await navigate(client, getWhaleStreamTopOptionsUrl(), 4500);
    const snapshot = await evaluate(client, `
      (async () => {
        const topOptionLinks = [...document.querySelectorAll('a[href*="/market-tracker/"]')]
          .map((anchor) => anchor.textContent?.trim() || "")
          .filter((text) => /^[A-Z]{1,5}$/.test(text));

        let newsStatus = null;
        let hasNewsAccess = false;
        let darkPoolStatus = null;
        let hasDarkPoolAccess = false;
        let message = "";

        try {
          const newsResponse = await fetch("/market-data/news", {
            credentials: "include",
          });
          newsStatus = newsResponse.status;
          const newsHtml = await newsResponse.text();
          hasNewsAccess = newsResponse.ok && /\\/news\\//i.test(newsHtml);
          if (!hasNewsAccess) {
            message = newsHtml.slice(0, 160);
          }
        } catch (error) {
          message = String(error);
        }

        try {
          const darkPoolResponse = await fetch("/market-data/top-dark-pool-flow", {
            credentials: "include",
          });
          darkPoolStatus = darkPoolResponse.status;
          const darkPoolHtml = await darkPoolResponse.text();
          hasDarkPoolAccess = darkPoolResponse.ok && /market-tracker/i.test(darkPoolHtml);
          if (!hasDarkPoolAccess && !message) {
            message = darkPoolHtml.slice(0, 160);
          }
        } catch (error) {
          if (!message) {
            message = String(error);
          }
        }

        return {
          url: location.href,
          title: document.title,
          topOptionsCount: topOptionLinks.length,
          hasTopOptionsAccess: topOptionLinks.length > 0,
          newsStatus,
          hasNewsAccess,
          darkPoolStatus,
          hasDarkPoolAccess,
          message,
        };
      })()
    `);
    const result = summarizeWhaleStreamStatusSnapshot(snapshot);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result;
  } finally {
    await client.close();
  }
}
