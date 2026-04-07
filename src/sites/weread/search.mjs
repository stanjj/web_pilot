import { fetchWereadWebApi } from "./common.mjs";

export async function runWereadSearch(flags) {
  const keyword = String(flags.keyword || "").trim();
  const limit = Math.min(Number(flags.limit ?? 10), 30);
  if (!keyword) throw new Error("Missing required keyword");
  const data = await fetchWereadWebApi("/search/global", { keyword });
  const items = (data?.books || []).slice(0, limit).map((item, index) => ({
    rank: index + 1,
    title: item.bookInfo?.title || "",
    author: item.bookInfo?.author || "",
    bookId: item.bookInfo?.bookId || "",
  }));
  process.stdout.write(`${JSON.stringify({ ok: true, keyword, count: items.length, items }, null, 2)}\n`);
}
