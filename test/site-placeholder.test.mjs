import assert from "node:assert/strict";
import test from "node:test";

import { EXIT_CODES } from "../src/core/errors.mjs";
import { runSitePlaceholder } from "../src/core/site-placeholder.mjs";

async function captureStdout(run) {
  const writes = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = (chunk, encoding, callback) => {
    writes.push(String(chunk));
    if (typeof encoding === "function") encoding();
    if (typeof callback === "function") callback();
    return true;
  };

  try {
    return {
      result: await run(),
      output: writes.join(""),
    };
  } finally {
    process.stdout.write = originalWrite;
  }
}

test("runSitePlaceholder returns unsupported output and sets exit code", async () => {
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;

  try {
    const { result, output } = await captureStdout(() => runSitePlaceholder("example", "sync", { dryRun: true }));
    assert.deepEqual(result, {
      ok: false,
      site: "example",
      action: "sync",
      status: "placeholder",
      message: "CDP adapter placeholder only for example.",
      flags: { dryRun: true },
    });
    assert.deepEqual(JSON.parse(output), result);
    assert.equal(process.exitCode, EXIT_CODES.UNSUPPORTED);
  } finally {
    process.exitCode = previousExitCode;
  }
});