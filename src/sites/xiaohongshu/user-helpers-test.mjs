import { buildXhsNoteUrl, normalizeXhsUserId } from "./user-helpers.mjs";

export async function runXiaohongshuUserHelpersTest() {
  process.stdout.write(`${JSON.stringify({
    ok: true,
    userId: normalizeXhsUserId("https://www.xiaohongshu.com/user/profile/abc123"),
    noteUrl: buildXhsNoteUrl("abc123", "note456", "token789"),
  }, null, 2)}\n`);
}
