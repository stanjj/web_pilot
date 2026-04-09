import assert from "node:assert/strict";
import test from "node:test";

import { searchBossJobs } from "../src/sites/boss/search-service.mjs";

test("searchBossJobs delegates to a lazily loaded runtime implementation", async () => {
  const calls = [];
  const options = {
    query: "platform engineer",
    city: "shanghai",
    limit: 10,
    page: 2,
    port: 9555,
  };
  const expected = {
    ok: true,
    count: 1,
    items: [{ jobName: "Platform Engineer" }],
  };

  const result = await searchBossJobs(options, {
    async loadRuntime() {
      calls.push("loadRuntime");
      return {
        async searchBossJobs(receivedOptions) {
          calls.push(receivedOptions);
          return expected;
        },
      };
    },
  });

  assert.equal(result, expected);
  assert.deepEqual(calls, ["loadRuntime", options]);
});

test("searchBossJobs fails clearly when the lazy runtime is miswired", async () => {
  await assert.rejects(
    () => searchBossJobs({ query: "platform engineer" }, { loadRuntime: async () => ({}) }),
    /missing searchBossJobs/,
  );
});