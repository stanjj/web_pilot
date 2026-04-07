import assert from "node:assert/strict";
import test from "node:test";

import { classifyChromeDebuggerOwner, getChromeCommandLineArg } from "../src/core/browser-process.mjs";

test("classifyChromeDebuggerOwner verifies the expected profile on the target port", () => {
  const result = classifyChromeDebuggerOwner([
    {
      ProcessId: 42,
      CommandLine: 'chrome.exe --remote-debugging-port=9223 --user-data-dir=C:\\Users\\testuser\\cdp_everything\\profiles\\agent',
    },
  ], {
    port: 9223,
    profileDir: "C:\\Users\\testuser\\cdp_everything\\profiles\\agent",
  });

  assert.equal(result.ok, true);
  assert.equal(result.processId, 42);
});

test("classifyChromeDebuggerOwner also matches non-chrome Chromium binaries on the target port", () => {
  const result = classifyChromeDebuggerOwner([
    {
      ProcessId: 77,
      CommandLine: 'msedge.exe --remote-debugging-port=9223 --user-data-dir="C:\\Users\\testuser\\cdp_everything\\profiles\\agent"',
    },
  ], {
    port: 9223,
    profileDir: "C:\\Users\\testuser\\cdp_everything\\profiles\\agent",
  });

  assert.equal(result.ok, true);
  assert.equal(result.processId, 77);
});

test("classifyChromeDebuggerOwner rejects another profile on the same debugger port", () => {
  const result = classifyChromeDebuggerOwner([
    {
      ProcessId: 9,
      CommandLine: 'chrome.exe --remote-debugging-port=9223 --user-data-dir=C:\\temp\\wrong-profile',
    },
  ], {
    port: 9223,
    profileDir: "C:\\Users\\testuser\\cdp_everything\\profiles\\agent",
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "PROFILE_MISMATCH");
  assert.equal(result.matches.length, 1);
});

test("classifyChromeDebuggerOwner reports a missing process when the port is absent", () => {
  const result = classifyChromeDebuggerOwner([], {
    port: 9223,
    profileDir: "C:\\Users\\testuser\\cdp_everything\\profiles\\agent",
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "PROCESS_NOT_FOUND");
});

test("getChromeCommandLineArg handles quoted whole arguments with spaces", () => {
  const commandLine = 'chrome.exe "--remote-debugging-port=9223" "--user-data-dir=C:\\Users\\testuser\\Path With Spaces\\agent"';

  assert.equal(getChromeCommandLineArg(commandLine, "--remote-debugging-port"), "9223");
  assert.equal(
    getChromeCommandLineArg(commandLine, "--user-data-dir"),
    "C:\\Users\\testuser\\Path With Spaces\\agent",
  );
});

test("getChromeCommandLineArg handles space-separated values", () => {
  const commandLine = 'chrome.exe --remote-debugging-port 9223 --user-data-dir "C:\\Users\\testuser\\Path With Spaces\\agent"';

  assert.equal(getChromeCommandLineArg(commandLine, "--remote-debugging-port"), "9223");
  assert.equal(
    getChromeCommandLineArg(commandLine, "--user-data-dir"),
    "C:\\Users\\testuser\\Path With Spaces\\agent",
  );
});
