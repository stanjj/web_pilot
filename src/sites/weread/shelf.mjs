import { connectWereadPage, fetchWereadPrivateApi, getWereadUrl } from "./common.mjs";
import { navigate } from "../../core/cdp.mjs";

export async function runWereadShelf(flags) {
  const limit = Math.min(Number(flags.limit ?? 20), 30);
  const { client } = await connectWereadPage(flags.port);
  try {
    await navigate(client, getWereadUrl(), 2500);
    const result = await fetchWereadPrivateApi(client, "/shelf/sync", { synckey: 0, lectureSynckey: 0 });
    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({ ok: false, needsLogin: Boolean(result?.needsLogin), message: result?.needsLogin ? "WeRead shelf requires a logged-in session." : "WeRead shelf request failed.", body: result?.body || "" }, null, 2)}\n`);
      process.exitCode = result?.needsLogin ? 2 : 1;
      return;
    }
    const items = (result.data?.books || []).slice(0, limit).map((item) => ({
      title: item.bookInfo?.title || item.title || "",
      author: item.bookInfo?.author || item.author || "",
      progress: item.readingProgress != null ? `${item.readingProgress}%` : "-",
      bookId: item.bookId || item.bookInfo?.bookId || "",
    }));
    process.stdout.write(`${JSON.stringify({ ok: true, count: items.length, items }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
