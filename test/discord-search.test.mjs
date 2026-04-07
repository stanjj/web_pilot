import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDiscordSearchQuery,
  isDiscordSearchEmptyStateText,
  isDiscordSearchElement,
  normalizeDiscordSearchItems,
  normalizeDiscordSearchLimit,
  normalizeDiscordSearchRequest,
  normalizeDiscordServerTitle,
  resolveDiscordServerSelection,
  quoteDiscordSearchValue,
} from "../src/sites/discord-app/search.mjs";

test("buildDiscordSearchQuery combines Discord filter shortcuts with text query", () => {
  assert.equal(
    buildDiscordSearchQuery({
      query: "deploy failed",
      filters: {
        user: "alice",
        channel: "release-room",
        mentions: "bob",
        has: "link",
        after: "2026-04-01",
      },
    }),
    "from:alice in:release-room mentions:bob has:link after:2026-04-01 deploy failed",
  );
});

test("normalizeDiscordSearchRequest accepts aliases and quotes spaced values", () => {
  assert.deepEqual(
    normalizeDiscordSearchRequest({
      server: "顺哥的股市大家庭🏠",
      from: "Alice Smith",
      in: "release thread",
      query: "deploy failed",
      limit: 99,
    }),
    {
      server: "顺哥的股市大家庭🏠",
      query: "deploy failed",
      filters: {
        user: "Alice Smith",
        channel: "release thread",
      },
      resolvedQuery: 'from:"Alice Smith" in:"release thread" deploy failed',
      limit: 50,
    },
  );
});

test("normalizeDiscordSearchRequest allows filter-only searches", () => {
  assert.deepEqual(
    normalizeDiscordSearchRequest({
      user: "alice",
      channel: "general",
      limit: 0,
    }),
    {
      server: "",
      query: "",
      filters: {
        user: "alice",
        channel: "general",
      },
      resolvedQuery: "from:alice in:general",
      limit: 1,
    },
  );
});

test("normalizeDiscordSearchRequest rejects empty searches", () => {
  assert.throws(
    () => normalizeDiscordSearchRequest({ limit: true }),
    /Provide at least one search term/,
  );
});

test("normalizeDiscordSearchItems trims blank rows and reindexes after filtering", () => {
  assert.deepEqual(
    normalizeDiscordSearchItems([
      { title: "  first   result  " },
      { title: "无结果 筛选 排序 我们已掘地三尺，但是一无所获" },
      { title: "   " },
      { text: "second result" },
      "third result",
    ], 2),
    [
      { index: 1, title: "first result" },
      { index: 2, title: "second result" },
    ],
  );
});

test("isDiscordSearchEmptyStateText recognizes Discord no-result panels", () => {
  assert.equal(isDiscordSearchEmptyStateText("无结果 筛选 排序 我们已掘地三尺，但是一无所获"), true);
  assert.equal(isDiscordSearchEmptyStateText("No results We searched far and wide"), true);
  assert.equal(isDiscordSearchEmptyStateText("first result"), false);
});

test("quoteDiscordSearchValue escapes embedded quotes and spaces", () => {
  assert.equal(quoteDiscordSearchValue('Alice "Ops"'), '"Alice \\\"Ops\\\""');
  assert.equal(normalizeDiscordSearchLimit(true), 20);
});

test("normalizeDiscordServerTitle strips unread prefixes and duplicate lines", () => {
  assert.equal(normalizeDiscordServerTitle("未读消息，顺哥的股市大家庭🏠"), "顺哥的股市大家庭🏠");
  assert.equal(normalizeDiscordServerTitle("工具人的服务器\n工具人的服务器"), "工具人的服务器");
});

test("resolveDiscordServerSelection supports exact and unique partial matches", () => {
  const entries = [
    { title: "未读消息，顺哥的股市大家庭🏠", guildId: "1" },
    { title: "天纬投资", guildId: "2" },
  ];

  assert.deepEqual(resolveDiscordServerSelection(entries, "顺哥的股市大家庭🏠"), {
    ok: true,
    item: {
      title: "顺哥的股市大家庭🏠",
      guildId: "1",
    },
    matchType: "exact",
  });

  assert.deepEqual(resolveDiscordServerSelection(entries, "天纬"), {
    ok: true,
    item: {
      title: "天纬投资",
      guildId: "2",
    },
    matchType: "partial",
  });
});

test("resolveDiscordServerSelection reports ambiguity and misses clearly", () => {
  const ambiguous = resolveDiscordServerSelection([
    { title: "Alpha One", guildId: "1" },
    { title: "Alpha Two", guildId: "2" },
  ], "Alpha");
  assert.equal(ambiguous.ok, false);
  assert.match(ambiguous.error, /ambiguous/i);

  const missing = resolveDiscordServerSelection([{ title: "Beta", guildId: "3" }], "Gamma");
  assert.equal(missing.ok, false);
  assert.match(missing.error, /not found/i);
});

test("isDiscordSearchElement accepts the search combobox and rejects the message composer", () => {
  assert.equal(
    isDiscordSearchElement({ role: "combobox", ariaLabel: "搜索" }),
    true,
  );
  assert.equal(
    isDiscordSearchElement({ role: "textbox", ariaLabel: "消息@littlepig" }),
    false,
  );
});