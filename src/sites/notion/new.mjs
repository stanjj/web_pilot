export async function runNotionNew(flags) {
  const title = String(flags.title || "").trim();
  const apply = flags.apply === true || flags.send === true;
  process.stdout.write(`${JSON.stringify({
    ok: true,
    dryRun: !apply,
    sendBlocked: !apply,
    title,
    nextStep: apply ? "Apply mode requested, but live Notion page creation is intentionally gated in this repo." : "Re-run with --apply only after explicit user confirmation.",
  }, null, 2)}\n`);
}
