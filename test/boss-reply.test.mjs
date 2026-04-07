import assert from "node:assert/strict";
import test from "node:test";

import {
  getReplyMessageSignature,
  isClearlyArtificialMessage,
  isReplySendConfirmed,
} from "../src/sites/boss/reply.mjs";

test("isClearlyArtificialMessage blocks obvious machine probes but allows normal job-related language", () => {
  assert.equal(isClearlyArtificialMessage("test"), true);
  assert.equal(isClearlyArtificialMessage("test."), true);
  assert.equal(isClearlyArtificialMessage("probe!"), true);
  assert.equal(isClearlyArtificialMessage("hello from cdp"), true);
  assert.equal(isClearlyArtificialMessage("I have 5 years of test automation experience"), false);
  assert.equal(isClearlyArtificialMessage("I build automation and bot-detection systems in Node.js"), false);
});

test("isReplySendConfirmed accepts whitespace-normalized confirmations", () => {
  const state = {
    inputText: "",
    messageCount: 3,
    messages: [
      { sender: "friend", text: "Hi", status: "" },
      { sender: "me", text: "Thanks,\nI can discuss automation testing tomorrow.", status: "sent" },
    ],
  };

  assert.equal(
    isReplySendConfirmed(state, {
      message: "Thanks, I can discuss automation testing tomorrow.",
      beforeOwnMessageCount: 0,
      beforeLastOwnSignature: getReplyMessageSignature({ sender: "me", text: "Earlier message", status: "sent" }),
    }),
    true,
  );
});

test("isReplySendConfirmed rejects stale matching history when nothing changed", () => {
  const state = {
    inputText: "Hello there",
    messageCount: 3,
    ownMessageCount: 1,
    messages: [
      { sender: "me", text: "Hello there", status: "sent" },
    ],
  };

  assert.equal(
    isReplySendConfirmed(state, {
      message: "Hello there",
      beforeOwnMessageCount: 1,
      beforeLastOwnSignature: getReplyMessageSignature({ sender: "me", text: "Hello there", status: "sent" }),
    }),
    false,
  );
});

test("isReplySendConfirmed ignores unrelated incoming messages when my latest matching reply is stale", () => {
  const state = {
    inputText: "Hello there",
    messageCount: 4,
    ownMessageCount: 1,
    messages: [
      { sender: "friend", text: "Following up", status: "" },
      { sender: "me", text: "Hello there", status: "sent" },
    ],
  };

  assert.equal(
    isReplySendConfirmed(state, {
      message: "Hello there",
      beforeOwnMessageCount: 1,
      beforeLastOwnSignature: getReplyMessageSignature({ sender: "me", text: "Hello there", status: "sent" }),
    }),
    false,
  );
});

test("isReplySendConfirmed rejects unchanged history even when the composer is empty", () => {
  const state = {
    inputText: "",
    messageCount: 3,
    ownMessageCount: 1,
    messages: [
      { sender: "me", text: "Hello there", status: "sent" },
    ],
  };

  assert.equal(
    isReplySendConfirmed(state, {
      message: "Hello there",
      beforeOwnMessageCount: 1,
      beforeLastOwnSignature: getReplyMessageSignature({ sender: "me", text: "Hello there", status: "sent" }),
    }),
    false,
  );
});
