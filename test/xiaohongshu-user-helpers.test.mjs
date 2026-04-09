import assert from "node:assert/strict";
import test from "node:test";

import { buildXhsNoteUrl, normalizeXhsUserId } from "../src/sites/xiaohongshu/user-helpers-core.mjs";
import { runXiaohongshuUserHelpersTest } from "../src/sites/xiaohongshu/user-helpers-test.mjs";

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

test("normalizeXhsUserId extracts IDs from profile URLs and trailing paths", () => {
  assert.equal(
    normalizeXhsUserId("https://www.xiaohongshu.com/user/profile/abc123?xsec_token=token789"),
    "abc123",
  );
  assert.equal(normalizeXhsUserId(" https://www.xiaohongshu.com/user/profile/demoUser/ "), "demoUser");
  assert.equal(normalizeXhsUserId("plain-user-id"), "plain-user-id");
});

test("buildXhsNoteUrl preserves empty guards and optional token params", () => {
  assert.equal(buildXhsNoteUrl("", "note456", "token789"), "");
  assert.equal(buildXhsNoteUrl("abc123", "", "token789"), "");
  assert.equal(
    buildXhsNoteUrl("abc123", "note456"),
    "https://www.xiaohongshu.com/user/profile/abc123/note456",
  );
  assert.equal(
    buildXhsNoteUrl(" abc123 ", " note456 ", " token789 "),
    "https://www.xiaohongshu.com/user/profile/abc123/note456?xsec_token=token789&xsec_source=pc_user",
  );
});

test("runXiaohongshuUserHelpersTest keeps CLI output aligned with helpers", async () => {
  const output = await captureStdout(() => runXiaohongshuUserHelpersTest());
  assert.deepEqual(JSON.parse(output), {
    ok: true,
    userId: "abc123",
    noteUrl: "https://www.xiaohongshu.com/user/profile/abc123/note456?xsec_token=token789&xsec_source=pc_user",
  });
});