import assert from "node:assert/strict";
import test from "node:test";

import {
  formatBossThreadSelectionError,
  isBossThreadContextMatch,
  isBossThreadSelectionSafeForSend,
  resolveBossThreadSelection,
} from "../src/sites/boss/thread-selector.mjs";

const THREADS = [
  {
    domIndex: 0,
    name: "Alice",
    company: "Acme",
    title: "Backend Engineer",
    preview: "您好",
  },
  {
    domIndex: 1,
    name: "Alice",
    company: "Beta Cloud",
    title: "Backend Engineer",
    preview: "在吗",
  },
  {
    domIndex: 2,
    name: "Bob",
    company: "Acme",
    title: "Staff Engineer",
    preview: "方便聊吗",
  },
];

test("resolveBossThreadSelection selects a unique exact company/name match", () => {
  const result = resolveBossThreadSelection(THREADS, { name: "Alice Beta Cloud" });

  assert.equal(result.ok, true);
  assert.equal(result.item.domIndex, 1);
  assert.equal(result.matchType, "exact");
});

test("resolveBossThreadSelection rejects ambiguous recruiter-only matches", () => {
  const result = resolveBossThreadSelection(THREADS, { name: "Alice" });

  assert.equal(result.ok, false);
  assert.equal(result.code, "AMBIGUOUS_THREAD");
  assert.equal(result.candidates.length, 2);
});

test("resolveBossThreadSelection still supports explicit indexes", () => {
  const result = resolveBossThreadSelection(THREADS, { index: 2, name: "ignored" });

  assert.equal(result.ok, true);
  assert.equal(result.item.domIndex, 2);
  assert.equal(result.matchType, "index");
});

test("resolveBossThreadSelection does not use preview text as identity", () => {
  const result = resolveBossThreadSelection(THREADS, { name: "在吗" });

  assert.equal(result.ok, false);
  assert.equal(result.code, "THREAD_NOT_FOUND");
});

test("isBossThreadContextMatch includes title when available", () => {
  assert.equal(
    isBossThreadContextMatch(
      { name: "Alice", company: "Acme", title: "Backend Engineer" },
      { name: "Alice", company: "Acme", title: "Backend Engineer" },
    ),
    true,
  );

  assert.equal(
    isBossThreadContextMatch(
      { name: "Alice", company: "Acme", title: "Backend Engineer" },
      { name: "Alice", company: "Acme", title: "Staff Engineer" },
    ),
    false,
  );
});

test("company-only selectors are not treated as exact live-send identities", () => {
  const result = resolveBossThreadSelection(THREADS, { name: "Beta Cloud" });

  assert.equal(result.ok, true);
  assert.notEqual(result.matchType, "exact");
  assert.equal(isBossThreadSelectionSafeForSend(result), false);
});

test("unique recruiter names still require dry-run before live send", () => {
  const result = resolveBossThreadSelection(THREADS, { name: "Bob" });

  assert.equal(result.ok, true);
  assert.notEqual(result.matchType, "exact");
  assert.equal(isBossThreadSelectionSafeForSend(result), false);
});

test("index and exact selectors remain valid for live send", () => {
  assert.equal(isBossThreadSelectionSafeForSend({ ok: true, matchType: "index" }), true);
  assert.equal(isBossThreadSelectionSafeForSend({ ok: true, matchType: "exact" }), true);
});

test("formatBossThreadSelectionError includes candidate identities", () => {
  const result = resolveBossThreadSelection(THREADS, { name: "Alice" });

  assert.equal(
    formatBossThreadSelectionError(result),
    "Ambiguous thread selector: Alice. Candidates: [0] Alice / Acme / Backend Engineer; [1] Alice / Beta Cloud / Backend Engineer",
  );
});
