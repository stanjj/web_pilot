import { connectWereadPage, fetchWereadPrivateApi, formatWereadDate, getWereadUrl } from "./common.mjs";
import { navigate } from "../../core/cdp.mjs";

export async function runWereadNotes(flags) {
  const bookId = String(flags.bookId || flags.id || "").trim();
  const limit = Math.min(Number(flags.limit ?? 20), 50);
  if (!bookId) throw new Error("Missing required bookId");
  const { client } = await connectWereadPage(flags.port);
  try {
    await navigate(client, getWereadUrl(), 2500);
    const result = await fetchWereadPrivateApi(client, "/review/list", { bookId, listType: 11, mine: 1, synckey: 0 });
    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({ ok: false, bookId, needsLogin: Boolean(result?.needsLogin), message: result?.needsLogin ? "WeRead notes requires a logged-in session." : "WeRead notes request failed.", body: result?.body || "" }, null, 2)}\n`);
      process.exitCode = result?.needsLogin ? 2 : 1;
      return;
    }
    const items = (result.data?.reviews || []).slice(0, limit).map((item) => ({
      chapter: item.review?.chapterName || "",
      text: item.review?.abstract || "",
      review: item.review?.content || "",
      createTime: formatWereadDate(item.review?.createTime),
    }));
    process.stdout.write(`${JSON.stringify({ ok: true, bookId, count: items.length, items }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
