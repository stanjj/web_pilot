import { connectWereadPage, fetchWereadPrivateApi, getWereadUrl } from "./common.mjs";
import { navigate } from "../../core/cdp.mjs";

export async function runWereadBook(flags) {
  const bookId = String(flags.bookId || flags.id || "").trim();
  const port = flags.port;
  if (!bookId) throw new Error("Missing required bookId");
  const { client } = await connectWereadPage(port);
  try {
    await navigate(client, getWereadUrl(), 2500);
    const result = await fetchWereadPrivateApi(client, "/book/info", { bookId });
    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({ ok: false, bookId, needsLogin: Boolean(result?.needsLogin), message: result?.needsLogin ? "WeRead book requires a logged-in session." : "WeRead book request failed.", body: result?.body || "" }, null, 2)}\n`);
      process.exitCode = result?.needsLogin ? 2 : 1;
      return;
    }
    const data = result.data || {};
    process.stdout.write(`${JSON.stringify({
      ok: true,
      item: {
        title: data.title || "",
        author: data.author || "",
        publisher: data.publisher || "",
        intro: data.intro || "",
        category: data.category || "",
        rating: data.newRating ? `${(data.newRating / 10).toFixed(1)}%` : "-",
      },
    }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
