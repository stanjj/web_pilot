import assert from "node:assert/strict";
import test from "node:test";

import {
  needsReply,
  normalizeBossInboxView,
  normalizeBossNeedsReply,
  normalizeBossUnread,
  normalizeInbox,
} from "../src/sites/boss/inbox-helpers.mjs";

const SNAPSHOT = {
  totalUnread: 3,
  items: [
    {
      index: 0,
      name: "Alice",
      company: "Acme",
      title: "Backend Engineer",
      message: "已收到，稍后回复您",
      statusClass: "message-status status-read",
    },
    {
      index: 1,
      name: "Boss Zhang",
      company: "Beta Cloud",
      title: "Staff Engineer",
      message: "您正在与Boss张三沟通",
      statusClass: "",
    },
    {
      index: 2,
      name: "Carol",
      company: "Gamma",
      title: "Platform Lead",
      message: "方便聊一下岗位吗",
      statusClass: "",
    },
    {
      index: 3,
      name: "Dan",
      company: "Delta",
      title: "Tech Lead",
      message: "",
      statusClass: "",
    },
  ],
  emptyState: false,
};

test("needsReply ignores sent, placeholder, and empty messages", () => {
  assert.equal(needsReply(SNAPSHOT.items[0]), false);
  assert.equal(needsReply(SNAPSHOT.items[1]), false);
  assert.equal(needsReply(SNAPSHOT.items[2]), true);
  assert.equal(needsReply(SNAPSHOT.items[3]), false);
});

test("normalizeInbox keeps visible count and applies the requested limit", () => {
  assert.deepEqual(normalizeInbox(SNAPSHOT, 2), {
    ok: true,
    totalUnread: 3,
    visibleCount: 4,
    items: SNAPSHOT.items.slice(0, 2),
  });
});

test("normalize inbox helpers keep recent, reply-needed, and unread shapes stable", () => {
  const replyNeeded = normalizeBossNeedsReply(SNAPSHOT, 5);
  assert.equal(replyNeeded.items.length, 1);
  assert.equal(replyNeeded.items[0].name, "Carol");

  const inbox = normalizeBossInboxView(SNAPSHOT, 3);
  assert.equal(inbox.recent.length, 3);
  assert.equal(inbox.needsReply.length, 1);
  assert.equal(inbox.needsReply[0].company, "Gamma");

  assert.deepEqual(normalizeBossUnread(SNAPSHOT), {
    ok: true,
    totalUnread: 3,
    unreadVisibleCount: 4,
    emptyState: false,
  });

  assert.deepEqual(normalizeBossUnread(SNAPSHOT, 1), {
    ok: true,
    totalUnread: 3,
    unreadVisibleCount: 4,
    emptyState: false,
    items: SNAPSHOT.items.slice(0, 1),
  });
});
