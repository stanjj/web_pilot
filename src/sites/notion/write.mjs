export async function runNotionWrite(flags) {
  const text = String(flags.text || "").trim();
  const apply = flags.apply === true || flags.send === true;
  if (!text) throw new Error("Missing required --text");
  process.stdout.write(`${JSON.stringify({
    ok: true,
    dryRun: !apply,
    sendBlocked: !apply,
    textPreview: text.slice(0, 120),
    nextStep: apply ? "Apply mode requested, but live Notion writing is intentionally gated in this repo." : "Re-run with --apply only after explicit user confirmation.",
  }, null, 2)}\n`);
}
