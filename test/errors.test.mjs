import assert from "node:assert/strict";
import test from "node:test";

import {
  CliError,
  ValidationError,
  CdpConnectionError,
  NavigationError,
  ParseError,
  UnsupportedOperationError,
  TimeoutError,
  normalizeError,
  getExitCode,
  EXIT_CODES,
} from "../src/core/errors.mjs";

// ── Error type construction ──────────────────────────────────────

test("CliError stores code, hint, details, and exitCode", () => {
  const err = new CliError("boom", "CUSTOM", { hint: "try again", details: { x: 1 }, exitCode: 42 });
  assert.equal(err.message, "boom");
  assert.equal(err.code, "CUSTOM");
  assert.equal(err.hint, "try again");
  assert.deepEqual(err.details, { x: 1 });
  assert.equal(err.exitCode, 42);
  assert.ok(err instanceof Error);
});

test("ValidationError uses VALIDATION exit code", () => {
  const err = new ValidationError("bad input");
  assert.equal(err.code, "VALIDATION_ERROR");
  assert.equal(err.exitCode, EXIT_CODES.VALIDATION);
  assert.ok(err instanceof CliError);
});

test("CdpConnectionError includes default hint", () => {
  const err = new CdpConnectionError("no browser");
  assert.equal(err.exitCode, EXIT_CODES.CDP_CONNECTION);
  assert.ok(err.hint.includes("browser"));
});

test("NavigationError uses NAVIGATION exit code", () => {
  const err = new NavigationError("page not found");
  assert.equal(err.exitCode, EXIT_CODES.NAVIGATION);
});

test("ParseError uses PARSE exit code", () => {
  const err = new ParseError("invalid JSON");
  assert.equal(err.exitCode, EXIT_CODES.PARSE);
});

test("UnsupportedOperationError uses UNSUPPORTED exit code", () => {
  const err = new UnsupportedOperationError("not available");
  assert.equal(err.exitCode, EXIT_CODES.UNSUPPORTED);
});

test("TimeoutError uses TIMEOUT exit code", () => {
  const err = new TimeoutError("timed out");
  assert.equal(err.exitCode, EXIT_CODES.TIMEOUT);
});

// ── normalizeError ───────────────────────────────────────────────

test("normalizeError converts CliError with hint and details", () => {
  const err = new CliError("fail", "X", { hint: "do Y", details: [1, 2] });
  const envelope = normalizeError(err);

  assert.deepEqual(envelope, {
    ok: false,
    error: "fail",
    code: "X",
    hint: "do Y",
    details: [1, 2],
  });
});

test("normalizeError converts CliError without optional fields", () => {
  const err = new ValidationError("bad");
  const envelope = normalizeError(err);

  assert.equal(envelope.ok, false);
  assert.equal(envelope.error, "bad");
  assert.equal(envelope.code, "VALIDATION_ERROR");
  assert.equal(envelope.hint, undefined);
  assert.equal(envelope.details, undefined);
});

test("normalizeError converts plain Error", () => {
  const err = new Error("whoops");
  const envelope = normalizeError(err);

  assert.equal(envelope.ok, false);
  assert.equal(envelope.error, "whoops");
  assert.equal(envelope.code, "UNKNOWN_ERROR");
});

test("normalizeError converts plain Error with .code property", () => {
  const err = new Error("connection refused");
  err.code = "ECONNREFUSED";
  const envelope = normalizeError(err);

  assert.equal(envelope.code, "ECONNREFUSED");
});

test("normalizeError converts non-Error values", () => {
  assert.deepEqual(normalizeError("string error"), {
    ok: false,
    error: "string error",
    code: "UNKNOWN_ERROR",
  });

  assert.deepEqual(normalizeError(42), {
    ok: false,
    error: "42",
    code: "UNKNOWN_ERROR",
  });

  assert.deepEqual(normalizeError(null), {
    ok: false,
    error: "null",
    code: "UNKNOWN_ERROR",
  });
});

// ── getExitCode ──────────────────────────────────────────────────

test("getExitCode returns specific code for CliError subtypes", () => {
  assert.equal(getExitCode(new ValidationError("x")), EXIT_CODES.VALIDATION);
  assert.equal(getExitCode(new CdpConnectionError("x")), EXIT_CODES.CDP_CONNECTION);
  assert.equal(getExitCode(new TimeoutError("x")), EXIT_CODES.TIMEOUT);
});

test("getExitCode returns GENERAL for plain Error", () => {
  assert.equal(getExitCode(new Error("x")), EXIT_CODES.GENERAL);
});

test("getExitCode returns GENERAL for non-Error", () => {
  assert.equal(getExitCode("fail"), EXIT_CODES.GENERAL);
});

// ── EXIT_CODES are unique ────────────────────────────────────────

test("EXIT_CODES values are all unique integers", () => {
  const values = Object.values(EXIT_CODES);
  const unique = new Set(values);
  assert.equal(values.length, unique.size, "exit code values must be unique");
  for (const v of values) {
    assert.equal(typeof v, "number");
    assert.ok(Number.isInteger(v));
  }
});
