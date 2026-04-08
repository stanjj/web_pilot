import assert from "node:assert/strict";
import test from "node:test";

import { CdpConnectionError } from "../src/core/errors.mjs";
import { runBrowserSmoke } from "../src/commands/browser-smoke.mjs";

test("runBrowserSmoke fails when the CDP endpoint is unreachable", async () => {
  await assert.rejects(
    runBrowserSmoke({ port: 9223 }, {
      probeCdpFn: async () => null,
    }),
    CdpConnectionError,
  );
});

test("runBrowserSmoke bootstraps an attachable page and reports smoke checks", async () => {
  const outputs = [];
  const client = {
    close: async () => {},
  };
  let listCall = 0;

  const result = await runBrowserSmoke({ port: 9223 }, {
    probeCdpFn: async () => ({
      Browser: "Chrome/123",
      webSocketDebuggerUrl: "ws://127.0.0.1:9223/devtools/browser/test",
    }),
    listTargetsFn: async () => {
      listCall += 1;
      if (listCall === 1) {
        return [];
      }
      return [{
        id: "page-1",
        type: "page",
        url: "about:blank",
        webSocketDebuggerUrl: "ws://127.0.0.1:9223/devtools/page/1",
      }];
    },
    ensureAttachablePageTargetFn: async () => ({
      ok: true,
      created: true,
      attachablePageCount: 1,
      targetId: "page-1",
      url: "about:blank",
    }),
    connectToTargetFn: async (target) => {
      assert.equal(target.id, "page-1");
      return client;
    },
    minimizeBrowserWindowFn: async () => ({ ok: true, minimized: true, windowId: 7 }),
    enforcePageTargetLimitFn: async () => ({
      ok: true,
      closed: 0,
      requiredClosed: 0,
      maxTabs: 15,
      before: 1,
      after: 1,
      remainingOverflow: 0,
      closeErrors: [],
    }),
    writeOutput: (text) => outputs.push(JSON.parse(text)),
  });

  assert.equal(result.ok, true);
  assert.equal(result.summary.bootstrappedPage, true);
  assert.equal(result.checks.sharedBrowserAttach.targetId, "page-1");
  assert.equal(result.checks.windowMinimization.ok, true);
  assert.equal(result.checks.tabCountEnforcement.ok, true);
  assert.equal(outputs.length, 1);
  assert.equal(outputs[0].ok, true);
});

test("runBrowserSmoke falls back to the bootstrapped target when target listing is stale", async () => {
  const client = {
    close: async () => {},
  };

  const result = await runBrowserSmoke({ port: 9223 }, {
    probeCdpFn: async () => ({
      Browser: "Chrome/123",
      webSocketDebuggerUrl: "ws://127.0.0.1:9223/devtools/browser/test",
    }),
    listTargetsFn: async () => [],
    ensureAttachablePageTargetFn: async () => ({
      ok: true,
      created: true,
      attachablePageCount: 1,
      targetId: "page-1",
      url: "about:blank",
      target: {
        id: "page-1",
        type: "page",
        url: "about:blank",
        webSocketDebuggerUrl: "ws://127.0.0.1:9223/devtools/page/1",
      },
    }),
    connectToTargetFn: async (target) => {
      assert.equal(target.id, "page-1");
      return client;
    },
    minimizeBrowserWindowFn: async () => ({ ok: true, minimized: true, windowId: 7 }),
    enforcePageTargetLimitFn: async () => ({
      ok: true,
      closed: 0,
      requiredClosed: 0,
      maxTabs: 15,
      before: 1,
      after: 1,
      remainingOverflow: 0,
      closeErrors: [],
    }),
    writeOutput: () => {},
  });

  assert.equal(result.ok, true);
  assert.equal(result.summary.targetCount, 1);
  assert.equal(result.summary.pageTargetCount, 1);
  assert.equal(result.summary.attachablePageCount, 1);
  assert.equal(result.checks.sharedBrowserAttach.targetId, "page-1");
});