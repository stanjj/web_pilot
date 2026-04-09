export function normalizeReplyText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isClearlyArtificialMessage(message) {
  const text = normalizeReplyText(message).toLowerCase();
  if (!text) return true;
  const normalizedToken = text.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");

  const exactBlockedValues = new Set([
    "test",
    "testing",
    "probe",
    "cdp",
    "mcp",
  ]);

  if (exactBlockedValues.has(text) || exactBlockedValues.has(normalizedToken)) {
    return true;
  }

  const blockedPatterns = [
    /\bdry[\s-]?run\b/,
    /\bsafety check\b/,
    /\bhello from\b/,
    /\bvia cdp\b/,
    /\btest message\b/,
    /\bprobe message\b/,
    /\bthis is a test\b/,
  ];

  return blockedPatterns.some((pattern) => pattern.test(text));
}

export function getReplyMessageSignature(message) {
  if (!message || typeof message !== "object") return "";

  return [
    String(message.sender || "").trim(),
    normalizeReplyText(message.text),
    normalizeReplyText(message.status),
  ].join("::");
}

function getLatestOwnReply(messages) {
  return [...(Array.isArray(messages) ? messages : [])]
    .reverse()
    .find((item) => item?.sender === "me") || null;
}

export function isReplySendConfirmed(state, { message, beforeOwnMessageCount, beforeLastOwnSignature } = {}) {
  const expectedText = normalizeReplyText(message);
  const latestOwnReply = getLatestOwnReply(state?.messages);

  if (!expectedText || !latestOwnReply) {
    return false;
  }

  if (normalizeReplyText(latestOwnReply.text) !== expectedText) {
    return false;
  }

  const countIncreased = Number(state?.ownMessageCount || 0) > Number(beforeOwnMessageCount || 0);
  const signatureChanged = beforeLastOwnSignature
    ? getReplyMessageSignature(latestOwnReply) !== beforeLastOwnSignature
    : true;

  if (countIncreased || signatureChanged) {
    return true;
  }

  return false;
}