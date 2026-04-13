import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectXueqiuPage, getXueqiuPort } from "./common.mjs";

export async function fetchXueqiuSymbolSentiment(flags) {
  const symbol = String(flags.symbol || "").trim().toUpperCase();
  if (!symbol) throw new Error("Missing required --symbol");
  const port = getXueqiuPort(flags.port);
  const { client } = await connectXueqiuPage(port);

  try {
    await navigate(client, `https://xueqiu.com/S/${encodeURIComponent(symbol)}`, 5000);
    const data = await evaluate(client, `
      (() => {
        const text = document.body.innerText || "";
        const followersMatch = text.match(/([0-9,]+(?:\\.[0-9]+)?[万千]?)\\s*(?:关注者|followers)/i);
        const discussionMatch = text.match(/([0-9,]+)\\s*(?:条|讨论|discussion)/i);
        return {
          followers: followersMatch?.[1] || null,
          discussions: discussionMatch?.[1] || null,
          pageTitle: document.title,
        };
      })()
    `);
    return {
      ok: true,
      symbol,
      source: "xueqiu",
      followers: data.followers ?? null,
      discussions: data.discussions ?? null,
      score: 0,
    };
  } finally {
    await client.close();
  }
}

export async function runXueqiuSymbolSentiment(flags) {
  const result = await fetchXueqiuSymbolSentiment(flags);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}
