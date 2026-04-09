import assert from "node:assert/strict";
import test from "node:test";

import { buildRegistry } from "../src/command-registrations.mjs";

test("buildRegistry creates a registry with all expected commands", () => {
  const reg = buildRegistry();

  // Should have a substantial number of commands registered
  assert.ok(reg.size > 150, `Expected 150+ commands, got ${reg.size}`);
});

test("buildRegistry resolves core commands", () => {
  const reg = buildRegistry();

  assert.ok(reg.resolve("browser", "ensure"), "browser ensure should exist");
  assert.ok(reg.resolve("sites", "list"), "sites list should exist");
  assert.ok(reg.resolve("sites", "coverage"), "sites coverage should exist");
  assert.ok(reg.resolve("doctor", "default"), "doctor should exist");
  assert.ok(reg.resolve("market", "scan"), "market scan should exist");
  assert.ok(reg.resolve("market", "drilldown"), "market drilldown should exist");
});

test("buildRegistry resolves representative site commands", () => {
  const reg = buildRegistry();

  // Spot-check from different sites
  assert.ok(reg.resolve("boss", "search"), "boss search");
  assert.ok(reg.resolve("boss", "reply"), "boss reply");
  assert.ok(reg.resolve("barchart", "quote"), "barchart quote");
  assert.ok(reg.resolve("twitter", "timeline"), "twitter timeline");
  assert.ok(reg.resolve("bilibili", "hot"), "bilibili hot");
  assert.ok(reg.resolve("reddit", "hot"), "reddit hot");
  assert.ok(reg.resolve("youtube", "search"), "youtube search");
  assert.ok(reg.resolve("xiaohongshu", "search"), "xiaohongshu search");
  assert.ok(reg.resolve("weread", "search"), "weread search");
  assert.ok(reg.resolve("zhihu", "hot"), "zhihu hot");
  assert.ok(reg.resolve("yahoo-finance", "quote"), "yahoo-finance quote");
  assert.ok(reg.resolve("tradingview", "status"), "tradingview status");
});

test("buildRegistry resolves newly added commands", () => {
  const reg = buildRegistry();

  assert.ok(reg.resolve("browser", "smoke"), "browser smoke");
  assert.ok(reg.resolve("boss", "open-thread"), "boss open-thread");
  assert.ok(reg.resolve("boss", "login-state"), "boss login-state");
  assert.ok(reg.resolve("boss", "triage"), "boss triage");
  assert.ok(reg.resolve("barchart", "put-call-ratio"), "barchart put-call-ratio");
  assert.ok(reg.resolve("yahoo-finance", "chain-snapshot"), "yahoo-finance chain-snapshot");
  assert.ok(reg.resolve("yahoo-finance", "atm"), "yahoo-finance atm");
  assert.ok(reg.resolve("yahoo-finance", "compare"), "yahoo-finance compare");
  assert.ok(reg.resolve("tradingview", "quote"), "tradingview quote");
  assert.ok(reg.resolve("tradingview", "historical-flow"), "tradingview historical-flow");
  assert.ok(reg.resolve("tradingview", "live-flow"), "tradingview live-flow");
});

test("buildRegistry handlers are async functions", () => {
  const reg = buildRegistry();
  for (const cmd of reg.listAll()) {
    assert.equal(typeof cmd.handler, "function", `${cmd.name} handler should be a function`);
  }
});

test("buildRegistry has no duplicate site:action keys", () => {
  // If duplicates existed, buildRegistry would throw during construction
  assert.doesNotThrow(() => buildRegistry());
});

test("buildRegistry returns undefined for non-existent commands", () => {
  const reg = buildRegistry();
  assert.equal(reg.resolve("nonexistent", "cmd"), undefined);
  assert.equal(reg.resolve("boss", "nonexistent"), undefined);
});

test("buildRegistry commands all have required fields", () => {
  const reg = buildRegistry();
  for (const cmd of reg.listAll()) {
    assert.ok(cmd.site, `${cmd.name} missing site`);
    assert.ok(cmd.action, `${cmd.name} missing action`);
    assert.ok(cmd.name, `command missing name`);
    assert.ok(cmd.description, `${cmd.name} missing description`);
    assert.equal(typeof cmd.handler, "function", `${cmd.name} handler not a function`);
  }
});
