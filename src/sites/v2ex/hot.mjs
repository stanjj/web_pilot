import { evaluate, navigate } from "../../core/cdp.mjs";
import { connectV2exPage, getV2exPort, getV2exUrl } from "./common.mjs";

async function runV2exList(kind, flags) {
  const limit = Number(flags.limit ?? 20);
  const port = getV2exPort(flags.port);
  const { client } = await connectV2exPage(port);

  try {
    await navigate(client, getV2exUrl(), 2000);

    const result = await evaluate(client, `
      (async () => {
        const limit = ${Number.isFinite(limit) ? Math.max(1, limit) : 20};
        const url = ${JSON.stringify(kind === "hot"
          ? "https://www.v2ex.com/api/topics/hot.json"
          : "https://www.v2ex.com/api/topics/latest.json")};

        try {
          const resp = await fetch(url);
          const text = await resp.text();
          if (!resp.ok) {
            return { ok: false, status: resp.status, body: text.slice(0, 300) };
          }

          let data;
          try {
            data = JSON.parse(text);
          } catch (error) {
            return { ok: false, status: resp.status, body: text.slice(0, 300), error: String(error) };
          }

          const items = (Array.isArray(data) ? data : []).slice(0, limit).map((item, index) => ({
            rank: index + 1,
            id: item?.id ?? null,
            title: item?.title || '',
            replies: item?.replies ?? 0,
            url: item?.url || '',
            member: item?.member?.username || '',
            node: item?.node?.name || ''
          }));

          return { ok: true, count: items.length, items };
        } catch (error) {
          return { ok: false, status: null, body: String(error) };
        }
      })()
    `);

    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        kind,
        status: result?.status ?? null,
        message: `V2EX ${kind} request failed.`,
        body: result?.body || "",
      }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      kind,
      count: result.count,
      items: result.items || [],
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}

export async function runV2exHot(flags) {
  await runV2exList("hot", flags);
}

export async function runV2exLatest(flags) {
  await runV2exList("latest", flags);
}
