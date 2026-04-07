import assert from "node:assert/strict";
import test from "node:test";

import { getBossAccessIssue } from "../src/sites/boss/common.mjs";

test("getBossAccessIssue flags login redirects on the BOSS user page", () => {
  const issue = getBossAccessIssue({
    url: "https://www.zhipin.com/web/user/",
    title: "",
    bodyText: "",
  }, "chat");

  assert.equal(issue?.code, "BOSS_LOGIN_REQUIRED");
  assert.match(issue?.message || "", /authenticated browser session/i);
});

test("getBossAccessIssue flags unexpected chat routes", () => {
  const issue = getBossAccessIssue({
    url: "https://www.zhipin.com/web/geek/recommend",
    title: "BOSS直聘",
    bodyText: "推荐职位",
  }, "chat");

  assert.equal(issue?.code, "BOSS_CHAT_UNAVAILABLE");
});

test("getBossAccessIssue allows the expected chat page", () => {
  assert.equal(
    getBossAccessIssue({
      url: "https://www.zhipin.com/web/geek/chat",
      title: "聊天",
      bodyText: "聊天列表",
    }, "chat"),
    null,
  );
});