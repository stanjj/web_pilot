import assert from "node:assert/strict";
import test from "node:test";

import {
  ensureFeishuReady,
  isFeishuWorkspaceUrl,
  pickPreferredFeishuTarget,
  summarizeFeishuPage,
} from "../src/sites/feishu/helpers.mjs";

test("isFeishuWorkspaceUrl distinguishes app pages from the marketing root", () => {
  assert.equal(isFeishuWorkspaceUrl("https://www.feishu.cn/"), false);
  assert.equal(isFeishuWorkspaceUrl("https://www.larksuite.com/en_sg/"), false);
  assert.equal(isFeishuWorkspaceUrl("https://www.larksuite.com/en_us/getstarted"), false);
  assert.equal(isFeishuWorkspaceUrl("https://app.feishu.cn/client/chat/open"), true);
});

test("pickPreferredFeishuTarget prefers app pages over marketing tabs", () => {
  assert.deepEqual(
    pickPreferredFeishuTarget([
      { type: "page", title: "Lark | Productivity Superapp for Chat, Meetings, Docs & Projects", url: "https://www.larksuite.com/en_sg/?from_site=feishu" },
      { type: "page", title: "Lark Messenger", url: "https://app.feishu.cn/client/chat/open" },
    ]),
    { type: "page", title: "Lark Messenger", url: "https://app.feishu.cn/client/chat/open" },
  );
});

test("summarizeFeishuPage flags marketing pages as not ready", () => {
  const result = summarizeFeishuPage({
    url: "https://www.larksuite.com/en_sg/?from_site=feishu",
    title: "Lark | Productivity Superapp for Chat, Meetings, Docs & Projects",
    bodyText: "Lark Productivity Superapp Get Started Contact Sales",
    hasAppShell: false,
    hasSearchInput: false,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "Login or workspace required");
});

test("ensureFeishuReady throws a clear workspace-required error", () => {
  assert.throws(
    () => ensureFeishuReady({
      url: "https://www.larksuite.com/en_sg/?from_site=feishu",
      title: "Lark | Productivity Superapp for Chat, Meetings, Docs & Projects",
      bodyText: "Lark Productivity Superapp",
    }),
    /Open a logged-in Feishu\/Lark workspace page in the shared browser before using this command\./,
  );
});
