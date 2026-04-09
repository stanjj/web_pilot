import assert from "node:assert/strict";
import test from "node:test";

import * as triageRuntime from "../src/sites/boss/triage-runtime.mjs";

test("triage runtime exports the dependency surface expected by runBossTriage", () => {
  for (const key of [
    "connectBossPage",
    "navigate",
    "ensureBossPageReady",
    "fetchInboxSnapshot",
    "needsReply",
    "selectBossThread",
    "waitForSelectedBossThread",
    "readOpenThread",
  ]) {
    assert.equal(typeof triageRuntime[key], "function");
  }
});