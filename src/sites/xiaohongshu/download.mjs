export async function runXiaohongshuDownload(flags) {
  const noteId = String(flags.note_id || "").trim();
  const output = String(flags.output || "./xiaohongshu-downloads").trim();
  const apply = flags.apply === true || flags.send === true;
  if (!noteId) throw new Error("Missing required --note_id");
  process.stdout.write(`${JSON.stringify({
    ok: true,
    dryRun: !apply,
    sendBlocked: !apply,
    noteId,
    output,
    nextStep: apply ? "Apply mode requested, but Xiaohongshu download is intentionally gated in this repo." : "Re-run with --apply only after explicit user confirmation.",
  }, null, 2)}\n`);
}
