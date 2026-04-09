import { buildXhsNoteUrl, normalizeXhsUserId } from "./user-helpers-core.mjs";

export { buildXhsNoteUrl, normalizeXhsUserId } from "./user-helpers-core.mjs";

export async function runXiaohongshuUserHelpers(flags) {
  const input = String(flags.id || flags.url || "").trim();
  const noteId = String(flags.note_id || "").trim();
  const userId = input ? normalizeXhsUserId(input) : "";
  process.stdout.write(`${JSON.stringify({
    ok: true,
    input,
    userId,
    noteId,
    sampleNoteUrl: buildXhsNoteUrl(userId, noteId, flags.xsec_token || ""),
  }, null, 2)}\n`);
}
