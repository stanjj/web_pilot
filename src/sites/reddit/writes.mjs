function getPostFullname(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  if (raw.startsWith("t3_")) return raw;
  try {
    const url = new URL(raw);
    const match = url.pathname.match(/\/comments\/([A-Za-z0-9]+)\//);
    if (match) return `t3_${match[1]}`;
  } catch {
  }
  return /^([A-Za-z0-9]+)$/.test(raw) ? `t3_${raw}` : "";
}

export async function runRedditComment(flags) {
  const postId = getPostFullname(flags.post_id);
  const text = String(flags.text || "").trim();
  const apply = flags.apply === true || flags.send === true;
  if (!postId || !text) throw new Error("Missing required --post_id or --text");
  process.stdout.write(`${JSON.stringify({
    ok: true,
    dryRun: !apply,
    sendBlocked: !apply,
    thingId: postId,
    textPreview: text.slice(0, 140),
    nextStep: apply ? "Apply mode requested, but Reddit write commands are intentionally gated in this repo." : "Re-run with --apply only after explicit user confirmation.",
  }, null, 2)}\n`);
}

export async function runRedditSave(flags) {
  const postId = getPostFullname(flags.post_id);
  const undo = flags.undo === true;
  const apply = flags.apply === true || flags.send === true;
  if (!postId) throw new Error("Missing required --post_id");
  process.stdout.write(`${JSON.stringify({
    ok: true,
    dryRun: !apply,
    sendBlocked: !apply,
    action: undo ? "unsave" : "save",
    thingId: postId,
    nextStep: apply ? "Apply mode requested, but Reddit write commands are intentionally gated in this repo." : "Re-run with --apply only after explicit user confirmation.",
  }, null, 2)}\n`);
}

export async function runRedditSubscribe(flags) {
  const subreddit = String(flags.subreddit || "").trim();
  const undo = flags.undo === true;
  const apply = flags.apply === true || flags.send === true;
  if (!subreddit) throw new Error("Missing required --subreddit");
  process.stdout.write(`${JSON.stringify({
    ok: true,
    dryRun: !apply,
    sendBlocked: !apply,
    action: undo ? "unsubscribe" : "subscribe",
    subreddit,
    nextStep: apply ? "Apply mode requested, but Reddit write commands are intentionally gated in this repo." : "Re-run with --apply only after explicit user confirmation.",
  }, null, 2)}\n`);
}

export async function runRedditUpvote(flags) {
  const postId = getPostFullname(flags.post_id);
  const direction = String(flags.direction || "up").trim().toLowerCase();
  const apply = flags.apply === true || flags.send === true;
  if (!postId) throw new Error("Missing required --post_id");
  process.stdout.write(`${JSON.stringify({
    ok: true,
    dryRun: !apply,
    sendBlocked: !apply,
    thingId: postId,
    direction,
    nextStep: apply ? "Apply mode requested, but Reddit write commands are intentionally gated in this repo." : "Re-run with --apply only after explicit user confirmation.",
  }, null, 2)}\n`);
}
