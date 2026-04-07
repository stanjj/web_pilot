import { fetchWereadWebApi } from "./common.mjs";

export async function runWereadRanking(flags) {
  const category = String(flags.category || "all").trim();
  const limit = Math.min(Number(flags.limit ?? 20), 30);
  const data = await fetchWereadWebApi(`/bookListInCategory/${encodeURIComponent(category)}`, { rank: "1" });
  const items = (data?.books || []).slice(0, limit).map((item, index) => ({
    rank: index + 1,
    title: item.bookInfo?.title || "",
    author: item.bookInfo?.author || "",
    category: item.bookInfo?.category || "",
    readingCount: item.readingCount ?? 0,
    bookId: item.bookInfo?.bookId || "",
  }));
  process.stdout.write(`${JSON.stringify({ ok: true, category, count: items.length, items }, null, 2)}\n`);
}
