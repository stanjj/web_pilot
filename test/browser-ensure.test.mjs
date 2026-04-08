import assert from "node:assert/strict";
import test from "node:test";

import { ensureAttachablePageTarget, runBrowserEnsure } from "../src/commands/browser-ensure.mjs";

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
      ensureAttachablePageTargetFn: async () => ({
        ok: true,
        created: false,
        attachablePageCount: 1,
        targetId: "page-1",
      }),
    sleepFn: async () => {},
    writeOutput: (text) => outputs.push(JSON.parse(text)),
  });

  assert.equal(launched, true);
  assert.equal(outputs.length, 1);
  assert.equal(outputs[0].ok, true);
  assert.equal(outputs[0].reused, false);
  assert.equal(outputs[0].attachablePageCount, 1);
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

test("ensureAttachablePageTarget bootstraps a blank page when no attachable targets exist", async () => {
  const calls = [];
  const targetLists = [
    [{ id: "worker-1", type: "service_worker", url: "https://example.com/sw.js" }],
    [{ id: "page-1", type: "page", url: "about:blank", webSocketDebuggerUrl: "ws://127.0.0.1:9223/devtools/page/1" }],
  ];

  const result = await ensureAttachablePageTarget({
    port: 9223,
    listTargetsFn: async () => targetLists.shift() || [],
    createTargetFn: async (url, port) => {
      calls.push({ url, port });
      return { id: "page-1", type: "page", url, webSocketDebuggerUrl: "ws://127.0.0.1:9223/devtools/page/1" };
    },
  });

  assert.deepEqual(calls, [{ url: "about:blank", port: 9223 }]);
  assert.equal(result.ok, true);
  assert.equal(result.created, true);
  assert.equal(result.attachablePageCount, 1);
  assert.equal(result.targetId, "page-1");
  assert.equal(result.target?.webSocketDebuggerUrl, "ws://127.0.0.1:9223/devtools/page/1");
});

test("runBrowserEnsure reports bootstrapped attachable page for reused browser sessions", async () => {
  const outputs = [];

  await runBrowserEnsure({ port: 9223 }, {
    probeCdpFn: async () => ({
      Browser: "Chrome/123",
      webSocketDebuggerUrl: "ws://127.0.0.1:9223/devtools/browser/test",
    }),
    verifyExistingBrowserIdentityFn: async () => ({ ok: true, verified: true, processId: 42 }),
    ensureAttachablePageTargetFn: async () => ({
      ok: true,
      created: true,
      attachablePageCount: 1,
      targetId: "page-1",
    }),
    writeOutput: (text) => outputs.push(JSON.parse(text)),
  });

  assert.equal(outputs.length, 1);
  assert.equal(outputs[0].ok, true);
  assert.equal(outputs[0].reused, true);
  assert.equal(outputs[0].bootstrappedPage, true);
  assert.equal(outputs[0].attachablePageCount, 1);
  assert.equal(outputs[0].attachableTargetId, "page-1");
});
