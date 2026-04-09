import assert from "node:assert/strict";
import test from "node:test";

import { runYoutubeTranscriptGroupTest } from "../src/sites/youtube/transcript-group-test.mjs";
import { buildYoutubeUrlSet } from "../src/sites/youtube/utils-helpers.mjs";

async function captureStdout(run) {
  const writes = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = (chunk, encoding, callback) => {
    writes.push(String(chunk));
    if (typeof encoding === "function") encoding();
    if (typeof callback === "function") callback();
    return true;
  };

  try {
    await run();
  } finally {
    process.stdout.write = originalWrite;
  }

  return writes.join("");
}

test("buildYoutubeUrlSet normalizes watch URLs into all canonical forms", () => {
  assert.deepEqual(buildYoutubeUrlSet("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), {
    input: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    videoId: "dQw4w9WgXcQ",
    watchUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    shortUrl: "https://youtu.be/dQw4w9WgXcQ",
    embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
  });
});

test("buildYoutubeUrlSet accepts raw IDs and youtu.be short links", () => {
  assert.equal(buildYoutubeUrlSet("dQw4w9WgXcQ").videoId, "dQw4w9WgXcQ");
  assert.equal(buildYoutubeUrlSet("https://youtu.be/dQw4w9WgXcQ?t=43").videoId, "dQw4w9WgXcQ");
});

test("buildYoutubeUrlSet fails closed for blank or invalid input", () => {
  assert.deepEqual(buildYoutubeUrlSet(""), {
    input: "",
    videoId: "",
    watchUrl: "",
    shortUrl: "",
    embedUrl: "",
  });
  assert.equal(buildYoutubeUrlSet("not-a-youtube-url").videoId, "");
});

test("runYoutubeTranscriptGroupTest keeps CLI output aligned with helpers", async () => {
  const output = await captureStdout(() => runYoutubeTranscriptGroupTest());
  assert.deepEqual(JSON.parse(output), {
    ok: true,
    command: "youtube transcript-group",
    sample: {
      input: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      videoId: "dQw4w9WgXcQ",
      watchUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      shortUrl: "https://youtu.be/dQw4w9WgXcQ",
      embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    },
  });
});