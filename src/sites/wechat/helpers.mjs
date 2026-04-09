function readText(value) {
  return value == null ? "" : String(value).trim();
}

export function summarizeWechatPage(snapshot = {}) {
  const url = readText(snapshot.url);
  const title = readText(snapshot.title);
  const bodyText = readText(snapshot.bodyText);
  const chatCount = Number(snapshot.chatCount || 0);
  const hasChatShell = Boolean(snapshot.hasChatShell);
  const needsQr = /scan|扫码/i.test(bodyText);
  const ready = Boolean(!needsQr && (hasChatShell || chatCount > 0));

  return {
    ok: ready,
    status: ready ? "Connected" : needsQr ? "QR login required" : "Unready",
    url,
    title,
    loggedInHint: ready,
    needsQr,
    hasChatShell,
    chatCount,
  };
}

export function ensureWechatChatsReady(snapshot = {}) {
  const summary = summarizeWechatPage(snapshot);
  if (summary.ok) {
    return summary;
  }

  const message = summary.needsQr
    ? "Scan the WeChat QR code in the shared browser before using chat commands."
    : "Open a logged-in WeChat Web session in the shared browser before using chat commands.";

  const error = new Error(message);
  error.code = "WECHAT_SESSION_REQUIRED";
  error.details = summary;
  throw error;
}
