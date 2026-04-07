import { connectWereadPage, fetchWereadPrivateApi, getWereadUrl } from "./common.mjs";
import { navigate } from "../../core/cdp.mjs";

export async function runWereadNotebooks(flags) {
  const { client } = await connectWereadPage(flags.port);
  try {
    await navigate(client, getWereadUrl(), 2500);
    const result = await fetchWereadPrivateApi(client, "/user/notebooks");
    if (!result?.ok) {
      process.stdout.write(`${JSON.stringify({ ok: false, needsLogin: Boolean(result?.needsLogin), message: result?.needsLogin ? "WeRead notebooks requires a logged-in session." : "WeRead notebooks request failed.", body: result?.body || "" }, null, 2)}\n`);
      process.exitCode = result?.needsLogin ? 2 : 1;
      return;
    }
    const items = (result.data?.books || []).map((item) => ({
      title: item.book?.title || "",
      author: item.book?.author || "",
      noteCount: (item.bookmarkCount ?? 0) + (item.reviewCount ?? 0),
      bookId: item.bookId || "",
    }));
    process.stdout.write(`${JSON.stringify({ ok: true, count: items.length, items }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}
