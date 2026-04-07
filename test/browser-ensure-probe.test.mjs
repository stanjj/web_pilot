import assert from "node:assert/strict";
import test from "node:test";

import { probeCdp } from "../src/commands/browser-ensure.mjs";

test("probeCdp returns null when the version endpoint stalls", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (_url, options = {}) => new Promise((_resolve, reject) => {
    options.signal?.addEventListener("abort", () => {
      const error = new Error("The operation was aborted");
      error.name = "AbortError";
      reject(error);
    }, { once: true });
  });

  try {
    const result = await probeCdp(9223, 10);
    assert.equal(result, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("probeCdp returns null when the version response body stalls", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => ({
    ok: true,
    json: () => new Promise(() => {}),
  });

  try {
    const result = await probeCdp(9223, 10);
    assert.equal(result, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});