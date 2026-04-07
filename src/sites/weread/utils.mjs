export async function runWereadUtils(flags) {
  const bookId = String(flags.bookId || flags.id || "").trim();
  process.stdout.write(`${JSON.stringify({
    ok: Boolean(bookId),
    sampleSearch: "node src/cli.mjs weread search 三国演义",
    sampleBook: bookId ? `node src/cli.mjs weread book ${bookId} --port 9223` : "",
    note: "Use search/ranking/shelf to discover bookId values.",
  }, null, 2)}\n`);
}
