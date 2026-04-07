import { connectWereadPage, fetchWereadPrivateApi, formatWereadDate, getWereadUrl } from "./common.mjs";
import { navigate } from "../../core/cdp.mjs";

export async function runWereadHighlights(flags) {
  const bookId = String(flags.bookId || flags.id || "").trim();
  const limit = Math.min(Number(flags.limit ?? 20), 50);
  if (!bookId) throw new Error("Missing required bookId");
  const { client } = await connectWereadPage(flags.port);
  try {
    await navigate(client, getWereadUrl(), 2500);
    const result = await fetchWereadPrivateApi(client, "/book/bookmarklist", { bookId });
    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({ ok: false, bookId, needsLogin: Boolean(result?.needsLogin), message: result?.needsLogin ? "WeRead highlights requires a logged-in session." : "WeRead highlights request failed.", body: result?.body || "" }, null, 2)}\n`);
      process.exitCode = result?.needsLogin ? 2 : 1;
      return;
    }
    const items = (result.data?.updated || []).slice(0, limit).map((item) => ({
      chapter: item.chapterName || "",
      text: item.markText || "",
      createTime: formatWereadDate(item.createTime),
    }));
    process.stdout.write(`${JSON.stringify({ ok: true, bookId, count: items.length, items }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
