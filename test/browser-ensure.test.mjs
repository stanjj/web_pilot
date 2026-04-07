import assert from "node:assert/strict";
import test from "node:test";

import { runBrowserEnsure } from "../src/commands/browser-ensure.mjs";

test("runBrowserEnsure refuses to launch when the expected debugger owner already exists but probe is indeterminate", async () => {
  let launched = false;

  await assert.rejects(
    runBrowserEnsure({ port: 9223, profile: "agent" }, {
      probeCdpFn: async () => null,
      verifyExistingBrowserIdentityFn: async () => ({ ok: true, verified: true, processId: 42 }),
      launchDedicatedChromeFn: async () => {
        launched = true;
        return { ok: true };
      },
      sleepFn: async () => {},
      writeOutput: () => {},
    }),
    /expected Chrome profile, but the CDP endpoint did not respond in time/,
  );

  assert.equal(launched, false);
});

test("runBrowserEnsure still launches when no debugger owner is detected", async () => {
  let launched = false;
  let probeCalls = 0;
  const outputs = [];

  await runBrowserEnsure({ port: 9223, profile: "agent" }, {
    probeCdpFn: async () => {
      probeCalls += 1;
      if (probeCalls === 1) return null;
      return {
        Browser: "Chrome/123",
        webSocketDebuggerUrl: "ws://127.0.0.1:9223/devtools/browser/test",
      };
    },
    verifyExistingBrowserIdentityFn: async () => ({ ok: false, code: "PROCESS_NOT_FOUND" }),
    launchDedicatedChromeFn: async () => {
      launched = true;
      return { ok: true };
    },
    sleepFn: async () => {},
    writeOutput: (text) => outputs.push(JSON.parse(text)),
  });

  assert.equal(launched, true);
  assert.equal(outputs.length, 1);
  assert.equal(outputs[0].ok, true);
  assert.equal(outputs[0].reused, false);
});

test("runBrowserEnsure fails closed when the debugger port belongs to a different profile after a null probe", async () => {
  let launched = false;

  await assert.rejects(
    runBrowserEnsure({ port: 9223, profile: "agent" }, {
      probeCdpFn: async () => null,
      verifyExistingBrowserIdentityFn: async () => ({ ok: false, code: "PROFILE_MISMATCH" }),
      launchDedicatedChromeFn: async () => {
        launched = true;
        return { ok: true };
      },
      sleepFn: async () => {},
      writeOutput: () => {},
    }),
    /already attached to a different Chrome profile/,
  );

  assert.equal(launched, false);
});
