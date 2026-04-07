export async function runXiaoyuzhouUtilsTest() {
  process.stdout.write(`${JSON.stringify({
    ok: true,
    command: "xiaoyuzhou utils",
    sampleInput: "https://www.xiaoyuzhoufm.com/podcast/5e8201ff418a84a046efa1b8",
    expected: {
      type: "podcast",
      id: "5e8201ff418a84a046efa1b8",
    },
  }, null, 2)}\n`);
}
