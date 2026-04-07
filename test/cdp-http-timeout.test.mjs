import assert from "node:assert/strict";
import test from "node:test";

import { listTargets } from "../src/core/cdp.mjs";

test("listTargets times out when the CDP HTTP endpoint stalls", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (_url, options = {}) => new Promise((_resolve, reject) => {
    options.signal?.addEventListener("abort", () => {
      const error = new Error("The operation was aborted");
      error.name = "AbortError";
      reject(error);
    }, { once: true });
  });

  try {
    await assert.rejects(
      listTargets(9223, 10),
      /CDP HTTP request timed out after 10ms/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("listTargets times out when the CDP HTTP response body stalls", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => ({
    ok: true,
    json: () => new Promise(() => {}),
  });

  try {
    await assert.rejects(
      listTargets(9223, 10),
      /CDP HTTP response body timed out after 10ms/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});