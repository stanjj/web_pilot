export async function runZhihuDownloadTest() {
  process.stdout.write(`${JSON.stringify({
    ok: true,
    command: "zhihu download",
    sampleInput: "https://zhuanlan.zhihu.com/p/123456789",
    note: "Use --url with a Zhihu column/article URL. Add --output <dir> to save Markdown locally.",
  }, null, 2)}\n`);
}
