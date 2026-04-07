import assert from "node:assert/strict";
import test from "node:test";

import { CliError, EXIT_CODES } from "../src/core/errors.mjs";
import { executeJsonMode } from "../src/core/json-mode.mjs";

function makeRuntime() {
  const chunks = [];

  return {
    chunks,
    processState: { exitCode: undefined },
    stdout: {
      write(chunk) {
        chunks.push(typeof chunk === "string" ? chunk : chunk.toString());
        return true;
      },
    },
  };
}

test("executeJsonMode preserves nonzero success exit codes", async () => {
  const runtime = makeRuntime();

  await executeJsonMode(
    {
      name: "soft-success",
      handler: async () => {
        runtime.processState.exitCode = 1;
        runtime.stdout.write(`${JSON.stringify({ ok: true, message: "Not found fallback", item: null }, null, 2)}\n`);
      },
    },
    {},
    [],
    runtime,
  );

  assert.equal(runtime.processState.exitCode, 1);

  const payload = JSON.parse(runtime.chunks.join(""));
  assert.equal(payload.ok, true);
  assert.equal(payload.data.message, "Not found fallback");
  assert.equal(payload.data.item, null);
  assert.equal(payload.meta.command, "soft-success");
});

test("executeJsonMode serializes circular error details", async () => {
  const runtime = makeRuntime();
  const details = { reason: "bad-state" };
  details.self = details;

  await executeJsonMode(
    {
      name: "circular-error",
      handler: async () => {
        throw new CliError("Boom", "TEST_ERROR", {
          details,
          exitCode: EXIT_CODES.VALIDATION,
        });
      },
    },
    {},
    [],
    runtime,
  );

  assert.equal(runtime.processState.exitCode, EXIT_CODES.VALIDATION);

  const payload = JSON.parse(runtime.chunks.join(""));
  assert.equal(payload.ok, false);
  assert.equal(payload.code, "TEST_ERROR");
  assert.equal(payload.error, "Boom");
  assert.equal(payload.details.reason, "bad-state");
  assert.equal(payload.details.self, "[Circular]");
  assert.equal(payload.meta.command, "circular-error");
});