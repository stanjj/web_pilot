import { buildXhsNoteUrl, normalizeXhsUserId } from "./user-helpers-core.mjs";

function buildSampleResult() {
  return {
    ok: true,
    userId: normalizeXhsUserId("https://www.xiaohongshu.com/user/profile/abc123"),
    noteUrl: buildXhsNoteUrl("abc123", "note456", "token789"),
  };
}

export async function runXiaohongshuUserHelpersTest() {
  process.stdout.write(`${JSON.stringify(buildSampleResult(), null, 2)}\n`);
}
