import assert from "node:assert/strict";
import test from "node:test";

import {
  ensureWechatChatsReady,
  summarizeWechatPage,
} from "../src/sites/wechat/helpers.mjs";

test("summarizeWechatPage flags QR-gated sessions as not ready", () => {
  const result = summarizeWechatPage({
    url: "https://web.wechat.com/",
    title: "WeChat/Weixin for Web",
    bodyText: "Use your phone to scan QR code",
    hasChatShell: false,
    chatCount: 0,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "QR login required");
  assert.equal(result.needsQr, true);
});

test("summarizeWechatPage accepts a logged-in chat shell", () => {
  const result = summarizeWechatPage({
    url: "https://web.wechat.com/",
    title: "WeChat/Weixin for Web",
    bodyText: "Chats Contacts",
    hasChatShell: true,
    chatCount: 3,
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "Connected");
  assert.equal(result.loggedInHint, true);
});

test("ensureWechatChatsReady throws a QR-login error when WeChat is not authenticated", () => {
  assert.throws(
    () => ensureWechatChatsReady({
      url: "https://web.wechat.com/",
      title: "WeChat/Weixin for Web",
      bodyText: "Scan the QR code",
      hasChatShell: false,
      chatCount: 0,
    }),
    /Scan the WeChat QR code in the shared browser before using chat commands\./,
  );
});
