export async function runWereadUtilsTest() {
  process.stdout.write(`${JSON.stringify({
    ok: true,
    command: "weread utils",
    sampleBookId: "1000000",
  }, null, 2)}\n`);
}
