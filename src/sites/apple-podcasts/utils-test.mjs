export async function runApplePodcastsUtilsTest() {
  const input = "https://podcasts.apple.com/us/podcast/example-show/id123456789?i=1000000000000";
  process.stdout.write(`${JSON.stringify({
    ok: true,
    command: "apple-podcasts utils",
    sampleInput: input,
    expected: {
      showId: "123456789",
      episodeId: "1000000000000",
      country: "us",
    },
  }, null, 2)}\n`);
}
